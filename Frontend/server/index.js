import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { MongoClient } from 'mongodb';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { spawn, execFile } from 'child_process';
import { fileURLToPath } from 'url';
import { seedDatabase } from './seed.js';
import { seedBitcoinDatabase } from './seed_bitcoin.js';
import { createCorsOriginValidator, createWriteGuard, validateAnalyzedTransactions, validateRawTransactions, validateInvestigationBody } from './security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PYTHON_CMD = process.env.PYTHON_PATH || 'python';
const BACKEND_DIR = path.resolve(__dirname, '../../Backend');

// Bitcoin Core RPC Configuration & Status Checker
const BITCOIN_RPC_HOST = process.env.BITCOIN_RPC_HOST || '127.0.0.1';
const BITCOIN_RPC_PORT = process.env.BITCOIN_RPC_PORT || '8332';
const BITCOIN_RPC_USER = process.env.BITCOIN_RPC_USER || '';
const BITCOIN_RPC_PASSWORD = process.env.BITCOIN_RPC_PASSWORD || '';
const BITCOIN_SIMULATION_MODE = process.env.BITCOIN_SIMULATION_MODE === 'true' || process.env.FORCE_MOCK === 'true';

async function checkBitcoinCoreRpc(timeoutMs = 1500) {
  if (BITCOIN_SIMULATION_MODE) {
    return {
      status: 'SIMULATION',
      network: 'simulation',
      node: {
        status: 'SIMULATION',
        height: null,
        chain: 'simulation',
        connections: 0,
        mempool_txs: 0,
        message: 'Simulation mode explicitly configured'
      },
      mempool: {
        status: 'SIMULATION',
        count: 0,
        bytes: 0
      }
    };
  }

  const url = `http://${BITCOIN_RPC_HOST}:${BITCOIN_RPC_PORT}/`;
  const headers = { 'Content-Type': 'application/json' };
  if (BITCOIN_RPC_USER && BITCOIN_RPC_PASSWORD) {
    const auth = Buffer.from(`${BITCOIN_RPC_USER}:${BITCOIN_RPC_PASSWORD}`).toString('base64');
    headers['Authorization'] = `Basic ${auth}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = Date.now();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'vector_status_check',
        method: 'getblockchaininfo',
        params: []
      }),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!response.ok) {
      return {
        status: 'DEGRADED',
        network: 'unknown',
        node: {
          status: 'DEGRADED',
          height: null,
          error: `HTTP ${response.status}: ${response.statusText}`
        },
        mempool: {
          status: 'UNAVAILABLE',
          count: null
        }
      };
    }

    const data = await response.json();
    const info = data.result || {};
    const latencyMs = Date.now() - t0;

    let mempoolInfo = { status: 'AVAILABLE', count: 0, bytes: 0 };
    try {
      const mpRes = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'vector_mempool_check',
          method: 'getmempoolinfo',
          params: []
        }),
        signal: AbortSignal.timeout(1000)
      });
      if (mpRes.ok) {
        const mpData = await mpRes.json();
        mempoolInfo = {
          status: 'AVAILABLE',
          count: mpData.result?.size ?? 0,
          bytes: mpData.result?.bytes ?? 0
        };
      }
    } catch {
      mempoolInfo = { status: 'UNAVAILABLE', count: null };
    }

    const progress = info.verificationprogress ?? 1.0;
    const isDegraded = progress < 0.999 && ['main', 'test'].includes(info.chain);

    return {
      status: isDegraded ? 'DEGRADED' : 'CONNECTED',
      network: info.chain || 'regtest',
      node: {
        status: isDegraded ? 'DEGRADED' : 'CONNECTED',
        height: info.blocks ?? null,
        chain: info.chain,
        headers: info.headers,
        verificationprogress: progress,
        latency_ms: latencyMs,
        mempool_txs: mempoolInfo.count,
        error: null
      },
      mempool: mempoolInfo
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      status: 'DISCONNECTED',
      network: 'unknown',
      node: {
        status: 'DISCONNECTED',
        height: null,
        chain: null,
        mempool_txs: null,
        connections: 0,
        latency_ms: null,
        error: err.message || 'Connection refused'
      },
      mempool: {
        status: 'UNAVAILABLE',
        count: null,
        bytes: null
      }
    };
  }
}

const app = express();
const server = http.createServer(app);
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174')
  .split(',').map(origin => origin.trim()).filter(Boolean);
const corsOrigin = createCorsOriginValidator(allowedOrigins);
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '2mb' }));

const rejectWriteUnlessAuthorized = createWriteGuard();

// MongoDB connection
const mongoURL = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGO_DB_NAME || 'RedisTransactions';
const pollIntervalMs = Number(process.env.TXN_POLL_MS || 2000);
let db;

// Connect to MongoDB
async function connectToMongo() {
  try {
    const client = new MongoClient(mongoURL);
    await client.connect();
    console.log('Connected to MongoDB');
    db = client.db(dbName);
    
    // Auto-seed financial & bitcoin databases if empty
    await seedDatabase(false).catch(err => console.warn('Auto-seed warning (Financial):', err.message));
    await seedBitcoinDatabase(false).catch(err => console.warn('Auto-seed warning (Bitcoin):', err.message));
    
    // Setup change streams or polling fallback
    await setupChangeStreams();
    
    return client;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// Setup change streams
async function setupChangeStreams() {
  try {
    const hello = await db.admin().command({ hello: 1 });
    if (!hello.setName) {
      console.warn('MongoDB is not running as a replica set. Falling back to polling for realtime updates.');
      startPollingFallback();
      return;
    }
  } catch (e) {
    startPollingFallback();
  }
}

// Standalone MongoDB fallback: poll for new inserts and emit them over sockets.
function startPollingFallback() {
  const collections = [
    { name: 'fraud_transactions', label: 'fraud', event: 'newTransaction' },
    { name: 'legit_transactions', label: 'legitimate', event: 'newTransaction' },
    { name: 'bitcoin_transactions', label: 'bitcoin_tx', event: 'bitcoin:newTransaction' },
    { name: 'bitcoin_risk_events', label: 'bitcoin_risk', event: 'bitcoin:newRiskEvent' }
  ];

  const lastSeenByCollection = new Map();

  const initialize = async () => {
    for (const cfg of collections) {
      const latest = await db.collection(cfg.name).find().sort({ _id: -1 }).limit(1).toArray();
      lastSeenByCollection.set(cfg.name, latest[0]?._id || null);
    }
  };

  const poll = async () => {
    for (const cfg of collections) {
      const lastSeen = lastSeenByCollection.get(cfg.name);
      const query = lastSeen ? { _id: { $gt: lastSeen } } : {};

      const newDocs = await db
        .collection(cfg.name)
        .find(query)
        .sort({ _id: 1 })
        .toArray();

      if (newDocs.length > 0) {
        for (const doc of newDocs) {
          io.emit(cfg.event, doc);
        }
        lastSeenByCollection.set(cfg.name, newDocs[newDocs.length - 1]._id);
      }
    }
  };

  initialize()
    .then(() => {
      setInterval(() => {
        poll().catch((error) => {
          console.error('Polling fallback error:', error.message);
        });
      }, pollIntervalMs);

      console.log(`Polling fallback started (${pollIntervalMs} ms interval)`);
    })
    .catch((error) => {
      console.error('Failed to initialize polling fallback:', error.message);
    });
}

// ==========================================
// Financial Monitoring API Routes (Existing)
// ==========================================
app.get('/api/transactions', async (req, res) => {
  try {
    const fraudTransactions = await db.collection('fraud_transactions').find().toArray();
    const legitTransactions = await db.collection('legit_transactions').find().toArray();
    res.json([...fraudTransactions, ...legitTransactions]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.get('/api/transactions/stats', async (req, res) => {
  try {
    const fraudCount = await db.collection('fraud_transactions').countDocuments();
    const legitCount = await db.collection('legit_transactions').countDocuments();
    const totalCount = fraudCount + legitCount;
    const fraudPercentage = totalCount > 0 ? (fraudCount / totalCount) * 100 : 0;
    
    const fraudAmountCursor = await db.collection('fraud_transactions').aggregate([
      { $group: { _id: null, totalAmount: { $sum: '$Amount' } } }
    ]).toArray();
    const legitAmountCursor = await db.collection('legit_transactions').aggregate([
      { $group: { _id: null, totalAmount: { $sum: '$Amount' } } }
    ]).toArray();
    
    const fraudAmount = fraudAmountCursor.length > 0 ? fraudAmountCursor[0].totalAmount : 0;
    const legitAmount = legitAmountCursor.length > 0 ? legitAmountCursor[0].totalAmount : 0;
    const totalAmount = fraudAmount + legitAmount;
    const avgAmount = totalCount > 0 ? totalAmount / totalCount : 0;
    
    res.json({
      totalTransactions: totalCount,
      fraudTransactions: fraudCount,
      legitTransactions: legitCount,
      fraudPercentage: parseFloat(fraudPercentage.toFixed(2)),
      avgAmount: parseFloat(avgAmount.toFixed(2)),
      lastUpdated: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transaction stats' });
  }
});

// ==========================================
// V.E.C.T.O.R-BITCOIN API Routes (New)
// ==========================================

// 1. Status & Overview
app.get('/api/bitcoin/status', async (req, res) => {
  try {
    const totalBlocks = await db.collection('bitcoin_blocks').countDocuments();
    const totalTxs = await db.collection('bitcoin_transactions').countDocuments();
    const totalEntities = await db.collection('bitcoin_entities').countDocuments();
    const simulatedTransactions = await db.collection('bitcoin_transactions').countDocuments({ data_mode: 'SIMULATION' });
    const criticalLeads = await db.collection('bitcoin_risk_events').countDocuments({ risk_level: 'CRITICAL' });
    const highLeads = await db.collection('bitcoin_risk_events').countDocuments({ risk_level: 'HIGH' });
    
    const latestBlock = await db.collection('bitcoin_blocks').find({ height: { $ne: null } }).sort({ height: -1 }).limit(1).toArray();
    
    // Volume aggregation
    const volCursor = await db.collection('bitcoin_transactions').aggregate([
      { $group: { _id: null, totalBtc: { $sum: '$total_output_btc' } } }
    ]).toArray();
    const totalBtcMonitored = volCursor[0]?.totalBtc || 0.0;

    // 1. Probe real Bitcoin Core Node via read-only JSON-RPC
    const nodeStatus = await checkBitcoinCoreRpc(1500);

    // 2. Fetch verified system telemetry (measured ML latency & throughput) from MongoDB
    let telemetry = await db.collection('bitcoin_system_telemetry').findOne({ _id: 'telemetry' });
    if (!telemetry) {
      // Check if models exist on disk
      const modelsDir = path.resolve(process.cwd(), '../Backend/bitcoin/models');
      const requiredArtifacts = [
        'bitcoin_scaler.joblib', 'bitcoin_umap.joblib', 'bitcoin_hdbscan.joblib',
        'bitcoin_fallback_xgboost.joblib', 'bitcoin_cluster_0_bundle.pkl',
        'bitcoin_cluster_1_bundle.pkl', 'bitcoin_cluster_2_bundle.pkl'
      ];
      const artifactsPresent = requiredArtifacts.every(file => fs.existsSync(path.join(modelsDir, file)));

      telemetry = {
        model: {
          status: artifactsPresent ? 'ARTIFACTS_PRESENT_RUNTIME_UNVERIFIED' : 'MODEL_MISSING',
          name: 'V.E.C.T.O.R Multi-Model Behavioral Anomaly Detector',
          version: 'bitcoin_v1',
          loaded_at: null,
          features_count: 66,
          clusters_loaded: [],
          fallback_model: artifactsPresent ? 'xgboost' : null
        },
        throughput: {
          status: 'idle',
          tx_per_sec: 0.0,
          last_batch_tps: null,
          historical_avg_tps: null,
          processed_transactions: totalTxs,
          elapsed_seconds: null
        },
        inference: {
          status: 'unmeasured',
          latency_ms: null,
          avg_latency_ms: null,
          p95_latency_ms: null,
          sample_count: 0,
          breakdown: null
        }
      };
    }

    const currentBlockHeight = nodeStatus.node.height !== null
      ? nodeStatus.node.height
      : (latestBlock[0]?.height ?? null);

    res.json({
      network: nodeStatus.network,
      node_status: nodeStatus.status,
      dataset_mode: simulatedTransactions > 0
        ? (simulatedTransactions === totalTxs ? 'SIMULATION' : 'MIXED')
        : (BITCOIN_SIMULATION_MODE ? 'SIMULATION' : 'IMPORTED_OR_LIVE_UNVERIFIED'),
      simulated_transaction_count: simulatedTransactions,
      model_status: telemetry.model?.status || 'MODEL_UNVERIFIED',
      node: nodeStatus.node,
      model: telemetry.model || {},
      throughput: telemetry.throughput || { status: 'idle', tx_per_sec: 0.0 },
      inference: telemetry.inference || { status: 'unmeasured', latency_ms: null },
      mempool: nodeStatus.mempool,
      storage: {
        total_blocks_processed: totalBlocks,
        total_transactions: totalTxs,
        total_entities: totalEntities,
        total_btc_monitored: parseFloat(totalBtcMonitored.toFixed(4)),
        critical_leads_count: criticalLeads,
        high_leads_count: highLeads
      },
      // Backward-compatibility legacy fields (strictly measured / genuine values)
      current_block_height: currentBlockHeight,
      total_blocks_processed: totalBlocks,
      total_transactions: totalTxs,
      total_entities: totalEntities,
      total_btc_monitored: parseFloat(totalBtcMonitored.toFixed(4)),
      critical_leads_count: criticalLeads,
      high_leads_count: highLeads,
      tps: telemetry.throughput?.tx_per_sec ?? 0.0,
      model_latency_ms: telemetry.inference?.latency_ms ?? null,
      unconfirmed_txs: nodeStatus.mempool?.count ?? null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Blocks
app.get('/api/bitcoin/blocks', async (req, res) => {
  try {
    const blocks = await db.collection('bitcoin_blocks').find().sort({ height: -1 }).limit(20).toArray();
    res.json(blocks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/bitcoin/blocks/:height', async (req, res) => {
  try {
    const height = parseInt(req.params.height, 10);
    const block = await db.collection('bitcoin_blocks').findOne({ height: height });
    if (!block) return res.status(404).json({ error: 'Block not found' });
    res.json(block);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Transactions
// 3. Search & Universal Identifier Resolver
app.get('/api/bitcoin/search', async (req, res) => {
  try {
    const rawQuery = req.query.q || '';
    const query = rawQuery.trim();
    if (!query) return res.json([]);
    
    // Identifier Classification
    const isTxid = /^[a-fA-F0-9]{64}$/.test(query);
    const isEntity = /^ENT_/i.test(query);
    const isInvestigation = /^(INV|CASE)[-_]/i.test(query);
    const isAddress = /^(bc1|tb1|bcrt1|[13])[a-zA-HJ-NP-Z0-9]{24,90}$/.test(query);

    const results = [];
    const seenIds = new Set();

    const addResult = (item) => {
      const key = `${item.type}:${item.id}`;
      if (!seenIds.has(key)) {
        seenIds.add(key);
        results.push({ ...item, query_matched: query });
      }
    };

    // 1. Entity resolution
    if (isEntity || query.length >= 3) {
      const entities = await db.collection('bitcoin_entities').find({
        entity_id: { $regex: isEntity ? `^${query}` : query, $options: 'i' }
      }).limit(6).toArray();

      for (const e of entities) {
        addResult({
          type: 'entity',
          id: e.entity_id,
          label: e.entity_id,
          subLabel: `Cluster #${e.cluster_id ?? 0} • ${e.tx_count || 1} txs • ₿ ${e.total_volume_btc?.toFixed(2) || '0.00'}`,
          risk: e.risk_level || 'UNANALYZED'
        });
      }
    }

    // 2. Address lookup (in entities and transactions)
    if (isAddress || (!isTxid && !isInvestigation && query.length >= 4)) {
      const entitiesWithAddr = await db.collection('bitcoin_entities').find({
        $or: [
          { primary_address: { $regex: query, $options: 'i' } },
          { addresses: { $regex: query, $options: 'i' } }
        ]
      }).limit(6).toArray();

      for (const e of entitiesWithAddr) {
        const matchedAddr = e.addresses?.find(a => a.toLowerCase().includes(query.toLowerCase())) || e.primary_address;
        addResult({
          type: 'wallet',
          id: matchedAddr,
          label: matchedAddr,
          subLabel: `Entity: ${e.entity_id} • ₿ ${e.total_volume_btc?.toFixed(2) || '0.00'}`,
          risk: e.risk_level || 'UNANALYZED'
        });
      }
    }

    // 3. Transaction lookup
    if (isTxid || (!isEntity && !isInvestigation && query.length >= 6)) {
      const txs = await db.collection('bitcoin_transactions').find({
        txid: { $regex: isTxid ? `^${query}$` : query, $options: 'i' }
      }).limit(6).toArray();

      for (const t of txs) {
        addResult({
          type: 'transaction',
          id: t.txid,
          label: t.txid,
          subLabel: `Block #${t.block_height || 'mempool'} • ₿ ${t.total_output_btc?.toFixed(4)}`,
          risk: t.risk_level || 'UNANALYZED'
        });
      }
    }

    // 4. Investigation lookup
    if (isInvestigation || (!isTxid && query.length >= 3)) {
      const investigations = await db.collection('bitcoin_investigations').find({
        $or: [
          { investigation_id: { $regex: query, $options: 'i' } },
          { title: { $regex: query, $options: 'i' } },
          { seed_entity_id: { $regex: query, $options: 'i' } }
        ]
      }).limit(4).toArray();

      for (const inv of investigations) {
        addResult({
          type: 'investigation',
          id: inv.investigation_id,
          label: inv.investigation_id,
          subLabel: inv.title,
          risk: (inv.initial_risk_score ?? inv.risk_score) >= 70 ? 'CRITICAL' : 'HIGH'
        });
      }
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Wallet Intelligence & Analysis Engine
const handleWalletAnalysis = async (req, res) => {
  try {
    const rawAddr = req.params.address || '';
    const addr = rawAddr.trim();

    if (!addr) {
      return res.status(400).json({ error: 'Missing address or identifier parameter.' });
    }

    // 1. Resolve Entity: Support entity_id, primary_address, address list, or tx address
    let entity = await db.collection('bitcoin_entities').findOne({
      $or: [
        { entity_id: addr },
        { primary_address: addr },
        { addresses: addr }
      ]
    });

    // If not found directly, check transactions for input/output addresses
    if (!entity) {
      const txMatch = await db.collection('bitcoin_transactions').findOne({
        $or: [
          { input_addresses: addr },
          { output_addresses: addr },
          { 'inputs.address': addr },
          { 'outputs.address': addr }
        ]
      });

      if (txMatch?.entity_id) {
        entity = await db.collection('bitcoin_entities').findOne({ entity_id: txMatch.entity_id });
      }
    }

    // Check validity of identifier format
    const isAddressFormat = /^(bc1|tb1|bcrt1|[13])[a-zA-HJ-NP-Z0-9]{24,90}$/.test(addr);
    const isEntityFormat = /^ENT_/i.test(addr);
    const isTxidFormat = /^[a-fA-F0-9]{64}$/.test(addr);

    if (!entity) {
      if (!isAddressFormat && !isEntityFormat && !isTxidFormat) {
        return res.status(400).json({
          error: `Invalid Bitcoin identifier format: '${addr}'`,
          query: addr,
          status: 'INVALID_FORMAT'
        });
      }

      // Valid format, but unknown in local intelligence base -> cold start analysis
      return res.json({
        query_input: addr,
        resolved_entity_id: null,
        is_known: false,
        address: addr,
        entity: {
          entity_id: `ENT_COLD_START_${addr.slice(0, 8)}`,
          primary_address: addr,
          address_count: 1,
          cluster_id: null,
          anonymity_score: null,
          first_seen: null,
          last_seen: null
        },
        behavior: {
          velocity_1h: null,
          velocity_24h: null,
          total_volume_btc: null,
          avg_tx_value: null,
          counterparty_diversity: null
        },
        cluster: {
          cluster_id: null,
          name: 'Unclustered / Cold Start Wallet',
          archetype: null,
          avg_volume_btc: null,
          anomaly_percentage: null,
          description: 'No prior transaction history found in database.'
        },
        risk: {
          score: null,
          level: 'UNANALYZED',
          is_seed_illicit: false,
          propagated_risk: 0,
          components: {
            ml_anomaly: null,
            graph_risk: null,
            velocity_signal: null
          }
        },
        transactions: [],
        graph: { nodes: [{ id: addr, label: addr.slice(0, 8), type: 'address', risk_score: null, risk_level: 'UNANALYZED' }], edges: [] },
        patterns: [],
        investigation: {
          active_case: false,
          case_id: null,
          recommended: false
        },
        investigation_recommended: false,
        leads: [],
        analyzed_at: new Date().toISOString()
      });
    }

    // 2. Fetch associated transactions
    const txs = await db.collection('bitcoin_transactions').find({
      entity_id: entity.entity_id
    }).sort({ timestamp: -1, block_height: -1 }).limit(50).toArray();

    // 3. Compute real behavior metrics
    const timestamps = txs.map(t => t.timestamp || 0).filter(t => t > 0).sort((a, b) => a - b);
    const latestTs = timestamps.length > 0 ? timestamps[timestamps.length - 1] : 0;
    
    const vel1h = entity.velocity_1h ?? (latestTs > 0 ? txs.filter(t => (latestTs - (t.timestamp || 0)) <= 3600).length : null);
    const vel24h = entity.velocity_24h ?? (latestTs > 0 ? txs.filter(t => (latestTs - (t.timestamp || 0)) <= 86400).length : null);

    const totalVol = entity.total_volume_btc ?? (txs.length > 0
      ? txs.reduce((acc, t) => acc + (t.total_output_btc || 0), 0)
      : null);

    const avgVal = entity.avg_tx_value ?? (txs.length > 0 ? totalVol / txs.length : null);

    // 4. Cluster Profile
    const clusterId = entity.cluster_id ?? null;
    const clusterDoc = clusterId === null ? null : await db.collection('bitcoin_clusters').findOne({ cluster_id: clusterId });
    const clusterProfile = {
      cluster_id: clusterId,
      name: clusterDoc?.name || null,
      archetype: clusterDoc?.archetype || null,
      avg_volume_btc: clusterDoc?.avg_volume_btc ?? null,
      anomaly_percentage: clusterDoc?.anomaly_rate_pct ?? null,
      description: clusterDoc?.description || null
    };

    // 5. Graph Context (1-hop neighborhood)
    const nodesMap = new Map();
    const graphEdges = [];
    
    nodesMap.set(entity.entity_id, {
      id: entity.entity_id,
      label: entity.entity_id,
      type: 'entity',
      risk_score: entity.risk_score ?? null,
      risk_level: entity.risk_level || 'UNANALYZED'
    });

    for (const tx of txs.slice(0, 10)) {
      nodesMap.set(tx.txid, {
        id: tx.txid,
        label: `TX:${tx.txid.slice(0, 6)}...`,
        type: 'transaction',
        risk_score: tx.risk_score ?? null,
        risk_level: tx.risk_level || 'UNANALYZED',
        value_btc: tx.total_output_btc
      });

      graphEdges.push({
        source: entity.entity_id,
        target: tx.txid,
        edge_type: 'TRANSACTED',
        value_btc: tx.total_output_btc
      });

      for (const out of (tx.outputs || []).slice(0, 3)) {
        if (out.address && !nodesMap.has(out.address)) {
          nodesMap.set(out.address, {
            id: out.address,
            label: `Addr:${out.address.slice(0, 6)}...`,
            type: 'address',
            risk_score: tx.risk_score ?? null,
            risk_level: tx.risk_level || 'UNANALYZED'
          });
          graphEdges.push({
            source: tx.txid,
            target: out.address,
            edge_type: 'SENT_TO',
            value_btc: out.value_btc
          });
        }
      }
    }

    // 6. Investigation State
    const activeCase = await db.collection('bitcoin_investigations').findOne({
      $or: [
        { seed_entity_id: entity.entity_id },
        { entities: entity.entity_id }
      ]
    });

    const isRecommended = (entity.risk_score || 0) >= 60 || (entity.detected_patterns?.length > 0);

    // 7. Risk Leads
    const leads = await db.collection('bitcoin_risk_events').find({
      $or: [
        { entity_id: entity.entity_id },
        { txid: { $in: txs.map(t => t.txid) } }
      ]
    }).sort({ risk_score: -1 }).limit(10).toArray();

    // 8. Assemble Full Intelligence Report
    const intelligence = {
      query_input: addr,
      resolved_entity_id: entity.entity_id,
      is_known: true,
      address: addr,
      entity: {
        entity_id: entity.entity_id,
        primary_address: entity.primary_address || addr,
        address_count: entity.addresses?.length || 1,
        cluster_id: clusterId,
        anonymity_score: entity.anonymity_score ?? null,
        first_seen: entity.first_seen ?? (txs.length > 0 ? txs[txs.length - 1].timestamp ?? null : null),
        last_seen: entity.last_seen ?? (txs.length > 0 ? txs[0].timestamp ?? null : null)
      },
      behavior: {
        velocity_1h: vel1h === null ? null : Math.round(vel1h * 100) / 100,
        velocity_24h: vel24h === null ? null : Math.round(vel24h * 100) / 100,
        total_volume_btc: totalVol === null ? null : Math.round(totalVol * 10000) / 10000,
        avg_tx_value: avgVal === null ? null : Math.round(avgVal * 10000) / 10000,
        counterparty_diversity: entity.unique_counterparties ?? null
      },
      cluster: clusterProfile,
      risk: {
        score: entity.risk_score ?? null,
        level: entity.risk_level || 'UNANALYZED',
        is_seed_illicit: entity.is_seed_illicit || false,
        propagated_risk: entity.propagated_risk || 0,
        components: {
          ml_anomaly: entity.ml_anomaly_score ?? null,
          graph_risk: entity.graph_risk_score ?? null,
          velocity_signal: entity.velocity_risk ?? null
        }
      },
      transactions: txs,
      graph: {
        nodes: Array.from(nodesMap.values()),
        edges: graphEdges
      },
      patterns: entity.detected_patterns || [],
      investigation: {
        active_case: !!activeCase,
        case_id: activeCase?.investigation_id || null,
        case_title: activeCase?.title || null,
        status: activeCase?.status || null,
        recommended: isRecommended
      },
      investigation_recommended: isRecommended,
      leads: leads,
      analyzed_at: new Date().toISOString()
    };

    res.json(intelligence);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

app.post('/api/bitcoin/wallets/:address/analyze', handleWalletAnalysis);
app.get('/api/bitcoin/wallets/:address/analyze', handleWalletAnalysis);

app.get('/api/bitcoin/transactions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    const txs = await db.collection('bitcoin_transactions').find().sort({ block_height: -1, _id: -1 }).limit(limit).toArray();
    res.json(txs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/bitcoin/transactions/:txid', async (req, res) => {
  try {
    const tx = await db.collection('bitcoin_transactions').findOne({ txid: req.params.txid });
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    
    // Enrich with entity context
    if (tx.entity_id) {
      const entity = await db.collection('bitcoin_entities').findOne({ entity_id: tx.entity_id });
      if (entity) {
        tx.entity_context = {
          risk_score: entity.risk_score,
          cluster_id: entity.cluster_id,
          patterns: entity.detected_patterns || []
        };
      }
    }
    
    res.json(tx);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Entities & Addresses
app.get('/api/bitcoin/entities', async (req, res) => {
  try {
    const entities = await db.collection('bitcoin_entities').find().sort({ risk_score: -1 }).toArray();
    res.json(entities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/bitcoin/entity/:entity_id', async (req, res) => {
  try {
    const entity = await db.collection('bitcoin_entities').findOne({ entity_id: req.params.entity_id });
    if (!entity) return res.status(404).json({ error: 'Entity not found' });
    const txs = await db.collection('bitcoin_transactions').find({ entity_id: req.params.entity_id }).limit(20).toArray();
    
    // Enrich Entity
    const enrichedEntity = {
      ...entity,
      risk_components: {
        ml_anomaly: entity.ml_anomaly_score ?? null,
        graph_risk: entity.graph_risk_score ?? null,
        velocity_signal: entity.velocity_risk ?? null
      },
      propagated_risk: entity.propagated_risk ?? null,
      patterns: entity.detected_patterns || [],
      investigation_recommended: entity.risk_score >= 65,
      connected_entities: [] // This could be populated by a graph query if needed
    };
    
    res.json({ entity: enrichedEntity, transactions: txs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/bitcoin/address/:address', async (req, res) => {
  try {
    const addr = req.params.address;
    const txs = await db.collection('bitcoin_transactions').find({
      $or: [{ input_addresses: addr }, { output_addresses: addr }]
    }).limit(30).toArray();
    
    let received = 0, sent = 0;
    for (const tx of txs) {
      if (tx.output_addresses?.includes(addr)) received += (tx.total_output_btc || 0);
      if (tx.input_addresses?.includes(addr)) sent += (tx.total_input_btc || 0);
    }

    res.json({
      address: addr,
      tx_count: txs.length,
      total_received_btc: parseFloat(received.toFixed(4)),
      total_sent_btc: parseFloat(sent.toFixed(4)),
      balance_btc: parseFloat(Math.max(0, received - sent).toFixed(4)),
      transactions: txs
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Graph Explorer Subgraph
app.get('/api/bitcoin/graph/:node_id', async (req, res) => {
  try {
    const nodeId = req.params.node_id;
    const txs = await db.collection('bitcoin_transactions').find({
      $or: [{ txid: nodeId }, { entity_id: nodeId }, { input_addresses: nodeId }, { output_addresses: nodeId }]
    }).limit(15).toArray();

    const nodesMap = new Map();
    const edges = [];

    for (const tx of txs) {
      nodesMap.set(tx.txid, {
        id: tx.txid,
        label: `TX:${tx.txid.slice(0, 6)}...`,
        type: 'transaction',
        risk_score: tx.risk_score ?? null,
        risk_level: tx.risk_level || 'UNANALYZED',
        value_btc: tx.total_output_btc
      });

      for (const inp of tx.inputs || []) {
        if (inp.address) {
          if (!nodesMap.has(inp.address)) {
            nodesMap.set(inp.address, {
              id: inp.address,
              label: `Addr:${inp.address.slice(0, 6)}...`,
              type: 'address',
              risk_score: tx.risk_score ?? null,
              risk_level: tx.risk_level || 'UNANALYZED'
            });
          }
          edges.push({ source: inp.address, target: tx.txid, edge_type: 'SPENT', value_btc: inp.value_btc });
        }
      }

      for (const out of tx.outputs || []) {
        if (out.address) {
          if (!nodesMap.has(out.address)) {
            nodesMap.set(out.address, {
              id: out.address,
              label: `Addr:${out.address.slice(0, 6)}...`,
              type: 'address',
              risk_score: tx.risk_score ?? null,
              risk_level: tx.risk_level || 'UNANALYZED'
            });
          }
          edges.push({ source: tx.txid, target: out.address, edge_type: 'CREATED', value_btc: out.value_btc });
        }
      }
    }

    res.json({ nodes: Array.from(nodesMap.values()), edges });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Risk Queue (with pagination and bounded limits)
app.get('/api/bitcoin/risk-queue', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    const skip = Math.max(0, parseInt(req.query.skip || '0', 10));
    const leads = await db.collection('bitcoin_risk_events')
      .find()
      .sort({ risk_score: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    res.json(leads);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Behavioral Clusters
app.get('/api/bitcoin/clusters', async (req, res) => {
  try {
    // 1. Try to read persisted clusters from bitcoin_clusters collection
    let clusters = await db.collection('bitcoin_clusters').find().sort({ cluster_id: 1 }).toArray();

    // 2. If bitcoin_clusters collection is empty, aggregate dynamically from bitcoin_entities
    if (!clusters || clusters.length === 0) {
      const entityCount = await db.collection('bitcoin_entities').countDocuments();
      if (entityCount > 0) {
        const agg = await db.collection('bitcoin_entities').aggregate([
          { $match: { cluster_id: { $ne: null, $gte: 0 } } },
          {
            $group: {
              _id: '$cluster_id',
              entity_count: { $sum: 1 },
              avg_volume_btc: { $avg: '$total_received_btc' },
              avg_velocity_1h: { $avg: '$velocity_1h' },
              outliers: {
                $sum: {
                  $cond: [{ $gte: ['$risk_score', 70] }, 1, 0]
                }
              }
            }
          },
          { $sort: { _id: 1 } }
        ]).toArray();

        if (agg && agg.length > 0) {
          clusters = agg.map(g => ({
            cluster_id: g._id,
            name: `Behavioral Cluster #${g._id}`,
            description: `Data-derived community of ${g.entity_count} entities sharing structural transaction behavior.`,
            entity_count: g.entity_count,
            avg_volume_btc: g.avg_volume_btc === null ? null : Math.round((g.avg_volume_btc ?? 0) * 10000) / 10000,
            avg_velocity_1h: g.avg_velocity_1h === null ? null : Math.round((g.avg_velocity_1h ?? 0) * 10) / 10,
            anomaly_rate_pct: Math.round(((g.outliers || 0) / g.entity_count) * 1000) / 10
          }));
        }
      }
    }

    if (!clusters || clusters.length === 0) {
      return res.json([]);
    }

    // Clean MongoDB _id for serialization
    const cleanClusters = clusters.map(({ _id, ...rest }) => rest);
    res.json(cleanClusters);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Investigations — Extended with full investigation lifecycle
app.get('/api/bitcoin/investigations', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const skip = Math.max(0, parseInt(req.query.skip || '0', 10));

    // Exclude massive graph payloads in summary list to avoid multi-megabyte transfers
    const invs = await db.collection('bitcoin_investigations')
      .find({}, {
        projection: {
          graph_nodes: 0,
          graph_edges: 0,
          flow_path: 0,
          evidence: 0,
          risk_propagation_results: 0,
        }
      })
      .sort({ created_at: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Return summary view for listing
    const summaries = invs.map(inv => ({
      investigation_id: inv.investigation_id,
      seed_entity_id: inv.seed_entity_id,
      seed_transaction_id: inv.seed_transaction_id,
      initial_risk_score: inv.initial_risk_score,
      investigation_status: inv.investigation_status || inv.status || 'OPEN',
      investigation_depth: inv.investigation_depth || 0,
      trigger_reasons: inv.trigger_reasons || [],
      created_at: inv.created_at,
      discovered_entities_count: (inv.discovered_entities || []).length,
      discovered_transactions_count: (inv.discovered_transactions || []).length,
      detected_patterns_count: (inv.detected_patterns || []).length,
      leads_count: (inv.final_leads || []).length,
      title: inv.title || `Investigation: ${inv.investigation_id}`,
      description: inv.description || (inv.trigger_reasons || []).join('; '),
      priority: inv.priority || (inv.initial_risk_score >= 75 ? 'CRITICAL' : inv.initial_risk_score >= 50 ? 'HIGH' : 'MEDIUM'),
      status: inv.investigation_status || inv.status || 'OPEN',
      risk_score: inv.initial_risk_score || inv.risk_score || 0,
      created_by: inv.created_by || 'V.E.C.T.O.R Auto',
      entities: (inv.discovered_entities || inv.entities || []).slice(0, 10),
      transactions: (inv.discovered_transactions || inv.transactions || []).slice(0, 10),
      notes: inv.notes || '',
    }));
    res.json(summaries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bitcoin/investigations', async (req, res) => {
  try {
    if (rejectWriteUnlessAuthorized(req, res)) return;

    const body = req.body || {};
    const validated = validateInvestigationBody(body);
    if (validated.error) return res.status(400).json({ error: validated.error });
    const { seedEntityId, seedTxid, title, priority, notes } = validated;

    // Execute the Python investigation engine
    const args = [
      '-m', 'bitcoin.run_investigation',
      '--seed-entity', seedEntityId,
      '--seed-txid', seedTxid,
      '--title', title,
      '--priority', priority,
      '--notes', notes
    ];

    execFile(
      PYTHON_CMD,
      args,
      { cwd: BACKEND_DIR, maxBuffer: 25 * 1024 * 1024, timeout: 25000 },
      async (err, stdout, stderr) => {
        if (err) {
          console.error('Python investigation execution error:', err.message, stderr);
          const failedInv = {
            investigation_id: `INV-FAIL-${Date.now().toString().slice(-6)}`,
            seed_entity_id: seedEntityId,
            seed_transaction_id: seedTxid,
            title,
            priority,
            investigation_status: 'FAILED',
            status: 'FAILED',
            error: err.message || stderr,
            created_at: new Date().toISOString(),
            created_by: body.created_by || 'Analyst',
            notes,
          };
          await db.collection('bitcoin_investigations').insertOne(failedInv);
          return res.status(500).json({
            error: 'Investigation engine execution failed',
            details: err.message,
            investigation: failedInv
          });
        }

        try {
          const invResult = JSON.parse(stdout);
          io.emit('bitcoin:investigationCreated', invResult);
          return res.status(201).json(invResult);
        } catch (parseErr) {
          console.error('Failed to parse investigation JSON output:', parseErr, stdout);
          return res.status(500).json({
            error: 'Failed to parse investigation results from analytical engine',
            raw_output: stdout.slice(0, 500)
          });
        }
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8a. Full Investigation Detail
app.get('/api/bitcoin/investigations/:investigation_id', async (req, res) => {
  try {
    const inv = await db.collection('bitcoin_investigations').findOne({
      investigation_id: req.params.investigation_id
    });
    if (!inv) return res.status(404).json({ error: 'Investigation not found' });
    res.json(inv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8b. Investigation Graph
app.get('/api/bitcoin/investigations/:investigation_id/graph', async (req, res) => {
  try {
    const inv = await db.collection('bitcoin_investigations').findOne({
      investigation_id: req.params.investigation_id
    });
    if (!inv) return res.status(404).json({ error: 'Investigation not found' });
    res.json({
      nodes: inv.graph_nodes || [],
      edges: inv.graph_edges || [],
      seed: inv.seed_entity_id,
      max_depth: inv.investigation_depth || 3,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8c. Investigation Flow Path
app.get('/api/bitcoin/investigations/:investigation_id/flow', async (req, res) => {
  try {
    const inv = await db.collection('bitcoin_investigations').findOne({
      investigation_id: req.params.investigation_id
    });
    if (!inv) return res.status(404).json({ error: 'Investigation not found' });
    res.json({
      seed_entity: inv.seed_entity_id,
      seed_analysis: inv.seed_analysis || {},
      flow_path: inv.flow_path || [],
      evidence: inv.evidence || {},
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8d. Investigation Ranked Leads
app.get('/api/bitcoin/investigations/:investigation_id/leads', async (req, res) => {
  try {
    const inv = await db.collection('bitcoin_investigations').findOne({
      investigation_id: req.params.investigation_id
    });
    if (!inv) return res.status(404).json({ error: 'Investigation not found' });
    res.json({
      investigation_id: inv.investigation_id,
      seed_entity: inv.seed_entity_id,
      leads: inv.final_leads || [],
      total_leads: (inv.final_leads || []).length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('Client connected to real-time feed:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// 9. Geographic Distribution Stats (for heatmap visualization)
app.get('/api/bitcoin/geo-stats', async (req, res) => {
  try {
    // Try to read from ip_correlations collection first (populated by bulk_ingest)
    const stored = await db.collection('bitcoin_ip_correlations').find().sort({ tx_count: -1 }).toArray();
    if (stored.length > 0) {
      return res.json(stored);
    }

    // Fallback: aggregate from transactions
    const geoAgg = await db.collection('bitcoin_transactions').aggregate([
      { $group: {
          _id: '$geo_country',
          tx_count: { $sum: 1 },
          btc_volume: { $sum: '$total_output_btc' }
      }},
      { $sort: { tx_count: -1 } },
      { $project: { country: '$_id', tx_count: 1, btc_volume: { $round: ['$btc_volume', 4] }, _id: 0 }}
    ]).toArray();

    if (geoAgg.length > 0) return res.json(geoAgg);

    // Return empty array when no data exists (no fabricated countries)
    res.json([]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 10. IP Correlation Data
app.get('/api/bitcoin/ip-correlations', async (req, res) => {
  try {
    const entities = await db.collection('bitcoin_entities').find({
      unique_ips: { $exists: true }
    }).sort({ anonymity_score: -1 }).toArray();

    // Build IP correlation summary
    const torEntities = entities.filter(e => e.anonymity_score > 0.3);
    const crossLinked = entities.filter(e => (e.cross_entity_links || 0) > 0);

    res.json({
      total_entities_with_ip: entities.length,
      tor_using_entities: torEntities.length,
      cross_linked_entities: crossLinked.length,
      entities: entities.map(e => ({
        entity_id: e.entity_id,
        unique_ips: e.unique_ips || 0,
        geo_countries: e.geo_countries || [],
        anonymity_score: e.anonymity_score || 0,
        cross_entity_links: e.cross_entity_links || 0,
        is_seed_illicit: e.is_seed_illicit || false,
        risk_score: e.risk_score ?? null,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 11. Bulk Ingestion Endpoint (Executes real V.E.C.T.O.R intelligence pipeline)
app.post('/api/bitcoin/ingest', async (req, res) => {
  try {
    if (rejectWriteUnlessAuthorized(req, res)) return;

    const validationError = validateAnalyzedTransactions(req.body);
    if (validationError) return res.status(validationError.includes('maximum limit') ? 413 : 400).json({ error: validationError });
    const { transactions } = req.body;

    // Spawn the Python transaction analysis engine
    const child = spawn(PYTHON_CMD, ['-m', 'bitcoin.analyze_transaction', '--stdin'], {
      cwd: BACKEND_DIR,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', chunk => { stdoutData += chunk; });
    child.stderr.on('data', chunk => { stderrData += chunk; });

    child.on('close', code => {
      if (code !== 0) {
        console.error('analyze_transaction failed with exit code', code, stderrData);
        return res.status(500).json({
          error: 'Transaction analysis pipeline failed',
          details: stderrData.slice(0, 500)
        });
      }

      try {
        const result = JSON.parse(stdoutData);
        // Emit newly analyzed transactions and alerts via socket
        if (result.transactions && Array.isArray(result.transactions)) {
          for (const tx of result.transactions) {
            io.emit('bitcoin:newTransaction', tx);
          }
        }
        if (result.alerts && Array.isArray(result.alerts)) {
          for (const alert of result.alerts) {
            io.emit('bitcoin:newAlert', alert);
          }
        }

        res.status(201).json({
          status: 'SUCCESS',
          ingested: result.ingested_count,
          alerts: result.alerts_count,
          elapsed_ms: result.elapsed_ms,
          transactions: result.transactions,
          message: `Successfully analyzed and ingested ${result.ingested_count} transactions through V.E.C.T.O.R intelligence pipeline`
        });
      } catch (err) {
        console.error('Failed to parse analytical ingestion output:', err, stdoutData);
        res.status(500).json({
          error: 'Failed to parse analytical output',
          raw: stdoutData.slice(0, 500)
        });
      }
    });

    child.stdin.write(JSON.stringify(transactions));
    child.stdin.end();

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 11b. Raw Ingestion Endpoint (Records raw transactions with explicit pending status)
app.post('/api/bitcoin/ingest/raw', async (req, res) => {
  try {
    if (rejectWriteUnlessAuthorized(req, res)) return;

    const validationError = validateRawTransactions(req.body);
    if (validationError) return res.status(validationError.includes('maximum limit') ? 413 : 400).json({ error: validationError });
    const { transactions } = req.body;

    const docs = transactions.map(tx => ({
      ...tx,
      timestamp: tx.timestamp || Math.floor(Date.now() / 1000),
      status: 'pending_analysis',
      analysis_status: 'RAW_UNANALYZED',
      risk_score: null,
      risk_level: 'UNANALYZED',
      created_at: new Date().toISOString()
    }));

    await db.collection('bitcoin_transactions').insertMany(docs);
    res.status(201).json({
      ingested: docs.length,
      status: 'RAW_INGESTED',
      message: `Successfully recorded ${docs.length} raw transactions (pending analytical pipeline)`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 12. Risk Propagation Data
app.get('/api/bitcoin/risk-propagation', async (req, res) => {
  try {
    const entities = await db.collection('bitcoin_entities').find({
      propagated_risk: { $exists: true, $gt: 0 }
    }).sort({ propagated_risk: -1 }).toArray();

    const seeds = entities.filter(e => e.is_seed_illicit);
    const propagated = entities.filter(e => !e.is_seed_illicit && e.propagated_risk > 0);

    res.json({
      seed_count: seeds.length,
      propagated_count: propagated.length,
      seeds: seeds.map(e => ({ entity_id: e.entity_id, risk_score: e.risk_score })),
      propagated_entities: propagated.map(e => ({
        entity_id: e.entity_id,
        propagated_risk: e.propagated_risk,
        risk_score: e.risk_score,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Static SPA serving for production
const distPath = path.resolve(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  console.log('Serving production frontend from:', distPath);
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await connectToMongo();
});

export default app;
