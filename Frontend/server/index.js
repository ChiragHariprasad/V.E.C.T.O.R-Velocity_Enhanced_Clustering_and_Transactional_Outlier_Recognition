import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { MongoClient } from 'mongodb';
import cors from 'cors';
import { seedDatabase } from './seed.js';
import { seedBitcoinDatabase } from './seed_bitcoin.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const mongoURL = 'mongodb://localhost:27017';
const dbName = 'RedisTransactions';
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
    const criticalLeads = await db.collection('bitcoin_risk_events').countDocuments({ risk_level: 'CRITICAL' });
    const highLeads = await db.collection('bitcoin_risk_events').countDocuments({ risk_level: 'HIGH' });
    
    const latestBlock = await db.collection('bitcoin_blocks').find().sort({ height: -1 }).limit(1).toArray();
    
    // Volume aggregation
    const volCursor = await db.collection('bitcoin_transactions').aggregate([
      { $group: { _id: null, totalBtc: { $sum: '$total_output_btc' } } }
    ]).toArray();
    const totalBtcMonitored = volCursor[0]?.totalBtc || 0.0;

    res.json({
      current_block_height: latestBlock[0]?.height || 840250,
      total_blocks_processed: totalBlocks,
      total_transactions: totalTxs,
      total_entities: totalEntities,
      total_btc_monitored: parseFloat(totalBtcMonitored.toFixed(4)),
      critical_leads_count: criticalLeads,
      high_leads_count: highLeads,
      network: 'regtest',
      node_status: 'connected',
      model_status: 'operational',
      tps: 18.5,
      model_latency_ms: 12.4
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
app.get('/api/bitcoin/search', async (req, res) => {
  try {
    const query = (req.query.q || '').trim();
    if (!query) return res.json([]);
    
    // Determine type (very basic heuristic)
    const isTxid = query.length === 64;
    const isEntity = query.startsWith('ENT_BTC_');
    const isAddress = query.startsWith('bc1') || query.startsWith('1') || query.startsWith('3') || query.length >= 26;

    const results = [];
    
    if (isTxid || (!isEntity && !isAddress)) {
      const txs = await db.collection('bitcoin_transactions').find({ 
        txid: { $regex: query, $options: 'i' } 
      }).limit(5).toArray();
      txs.forEach(t => results.push({ type: 'transaction', id: t.txid, label: t.txid, subLabel: `₿ ${t.total_output_btc}`, risk: t.risk_level }));
    }
    
    if (isEntity || (!isTxid && !isAddress)) {
      const entities = await db.collection('bitcoin_entities').find({ 
        entity_id: { $regex: query, $options: 'i' } 
      }).limit(5).toArray();
      entities.forEach(e => results.push({ type: 'entity', id: e.entity_id, label: e.entity_id, subLabel: `Cluster ${e.cluster_id || 0}`, risk: e.risk_level }));
    }
    
    if (isAddress || (!isTxid && !isEntity)) {
      const entitiesWithAddress = await db.collection('bitcoin_entities').find({
        $or: [
          { primary_address: { $regex: query, $options: 'i' } },
          { addresses: { $regex: query, $options: 'i' } }
        ]
      }).limit(5).toArray();
      entitiesWithAddress.forEach(e => results.push({ type: 'wallet', id: query, label: query, subLabel: `Entity: ${e.entity_id}`, risk: e.risk_level }));
    }
    
    const investigations = await db.collection('bitcoin_investigations').find({
      $or: [
        { investigation_id: { $regex: query, $options: 'i' } },
        { title: { $regex: query, $options: 'i' } }
      ]
    }).limit(3).toArray();
    investigations.forEach(i => results.push({ type: 'investigation', id: i.investigation_id, label: i.investigation_id, subLabel: i.title, risk: i.risk_score > 75 ? 'CRITICAL' : 'HIGH' }));

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bitcoin/wallets/:address/analyze', async (req, res) => {
  try {
    const addr = req.params.address;
    
    // 1. Resolve entity
    const entity = await db.collection('bitcoin_entities').findOne({
      $or: [{ primary_address: addr }, { addresses: addr }, { entity_id: addr }]
    });

    if (!entity) {
      return res.status(404).json({ error: 'Address/Entity not found in intelligence database.' });
    }

    // 2. Fetch related transactions
    const txs = await db.collection('bitcoin_transactions').find({
      entity_id: entity.entity_id
    }).sort({ timestamp: -1 }).limit(50).toArray();

    // 3. Assemble intelligence report
    const intelligence = {
      address: addr,
      entity: {
        entity_id: entity.entity_id,
        primary_address: entity.primary_address,
        address_count: entity.addresses?.length || 1,
        cluster_id: entity.cluster_id || 0,
        anonymity_score: entity.anonymity_score || 0,
        first_seen: entity.first_seen || txs[txs.length - 1]?.date,
        last_seen: entity.last_seen || txs[0]?.date
      },
      behavior: {
        velocity_1h: entity.velocity_1h || 0,
        velocity_24h: entity.velocity_24h || 0,
        total_volume_btc: entity.total_volume_btc || 0,
        avg_tx_value: entity.avg_tx_value || 0,
        counterparty_diversity: entity.unique_counterparties || 0
      },
      risk: {
        score: entity.risk_score || 0,
        level: entity.risk_level || 'LOW',
        is_seed_illicit: entity.is_seed_illicit || false,
        propagated_risk: entity.propagated_risk || 0,
        components: {
          ml_anomaly: entity.ml_anomaly_score || 0,
          graph_risk: entity.graph_risk_score || 0,
          velocity_signal: entity.velocity_risk || 0
        }
      },
      transactions: txs,
      patterns: entity.detected_patterns || [],
      investigation_recommended: entity.risk_score >= 65 || (entity.detected_patterns?.length > 0)
    };

    // Simulate analysis delay for effect
    setTimeout(() => res.json(intelligence), 1500);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
        ml_anomaly: entity.ml_anomaly_score || 0,
        graph_risk: entity.graph_risk_score || 0,
        velocity_signal: entity.velocity_risk || 0
      },
      propagated_risk: entity.propagated_risk || 0,
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
        risk_score: tx.risk_score || 0,
        risk_level: tx.risk_level || 'LOW',
        value_btc: tx.total_output_btc
      });

      for (const inp of tx.inputs || []) {
        if (inp.address) {
          if (!nodesMap.has(inp.address)) {
            nodesMap.set(inp.address, {
              id: inp.address,
              label: `Addr:${inp.address.slice(0, 6)}...`,
              type: 'address',
              risk_score: tx.risk_score || 0,
              risk_level: tx.risk_level || 'LOW'
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
              risk_score: tx.risk_score || 0,
              risk_level: tx.risk_level || 'LOW'
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

// 6. Risk Queue
app.get('/api/bitcoin/risk-queue', async (req, res) => {
  try {
    const leads = await db.collection('bitcoin_risk_events').find().sort({ risk_score: -1, _id: -1 }).toArray();
    res.json(leads);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Behavioral Clusters
app.get('/api/bitcoin/clusters', async (req, res) => {
  try {
    res.json([
      {
        cluster_id: 0,
        name: 'Retail & Micropayment Stream',
        description: 'Frequent sub-0.1 BTC transactions with high young-UTXO turnover.',
        entity_count: 34,
        avg_volume_btc: 0.042,
        avg_velocity_1h: 6.8,
        anomaly_rate_pct: 3.2
      },
      {
        cluster_id: 1,
        name: 'Settlement & Custodial Storage',
        description: 'Infrequent high-value movements with older UTXO holding ages.',
        entity_count: 18,
        avg_volume_btc: 48.5,
        avg_velocity_1h: 0.4,
        anomaly_rate_pct: 1.5
      },
      {
        cluster_id: 2,
        name: 'High-Velocity Layering & Peel Dispersion',
        description: 'Rapid forwarding, multiple hops, asymmetric change splits.',
        entity_count: 12,
        avg_volume_btc: 8.9,
        avg_velocity_1h: 38.2,
        anomaly_rate_pct: 84.6
      }
    ]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Investigations — Extended with full investigation lifecycle
app.get('/api/bitcoin/investigations', async (req, res) => {
  try {
    const invs = await db.collection('bitcoin_investigations').find().sort({ created_at: -1, _id: -1 }).toArray();
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
      // Backward compat with old simple investigations
      title: inv.title || `Investigation: ${inv.investigation_id}`,
      description: inv.description || (inv.trigger_reasons || []).join('; '),
      priority: inv.priority || (inv.initial_risk_score >= 75 ? 'CRITICAL' : inv.initial_risk_score >= 50 ? 'HIGH' : 'MEDIUM'),
      status: inv.investigation_status || inv.status || 'OPEN',
      risk_score: inv.initial_risk_score || inv.risk_score || 0,
      created_by: inv.created_by || 'V.E.C.T.O.R Auto',
      entities: inv.discovered_entities || inv.entities || [],
      transactions: inv.discovered_transactions || inv.transactions || [],
      notes: inv.notes || '',
    }));
    res.json(summaries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bitcoin/investigations', async (req, res) => {
  try {
    const body = req.body;
    const newInv = {
      investigation_id: `INV-${Date.now().toString().slice(-6)}`,
      title: body.title || 'Untitled Investigation',
      description: body.description || '',
      priority: body.priority || 'MEDIUM',
      status: 'OPEN',
      investigation_status: 'OPEN',
      risk_score: body.risk_score || 50,
      initial_risk_score: body.risk_score || 50,
      seed_entity_id: body.seed_entity_id || (body.entities || [])[0] || '',
      seed_transaction_id: body.seed_txid || (body.transactions || [])[0] || '',
      created_by: body.created_by || 'Analyst',
      created_at: new Date().toISOString(),
      entities: body.entities || [],
      transactions: body.transactions || [],
      discovered_entities: body.entities || [],
      discovered_transactions: body.transactions || [],
      trigger_reasons: body.trigger_reasons || ['manual_investigation'],
      investigation_depth: 0,
      detected_patterns: [],
      evidence: {},
      final_leads: [],
      flow_path: [],
      graph_nodes: [],
      graph_edges: [],
      notes: body.notes || ''
    };
    await db.collection('bitcoin_investigations').insertOne(newInv);
    res.status(201).json(newInv);
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

    // Static fallback for demo
    res.json([
      { country: 'US', tx_count: 145, btc_volume: 234.56 },
      { country: 'DE', tx_count: 89, btc_volume: 156.23 },
      { country: 'RU', tx_count: 67, btc_volume: 445.12 },
      { country: 'CN', tx_count: 54, btc_volume: 189.34 },
      { country: 'NL', tx_count: 42, btc_volume: 312.78 },
      { country: 'RO', tx_count: 38, btc_volume: 89.45 },
      { country: 'SG', tx_count: 31, btc_volume: 67.89 },
      { country: 'GB', tx_count: 28, btc_volume: 45.23 },
      { country: 'JP', tx_count: 22, btc_volume: 34.56 },
      { country: 'XX', tx_count: 19, btc_volume: 567.89 }
    ]);
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
        risk_score: e.risk_score || 0,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 11. Bulk File Ingestion Endpoint (CSV/JSON upload)
app.post('/api/bitcoin/ingest', async (req, res) => {
  try {
    const { transactions } = req.body;
    if (!transactions || !Array.isArray(transactions)) {
      return res.status(400).json({ error: 'Request body must contain a "transactions" array' });
    }

    // Insert raw transactions with minimal processing (server-side)
    const docs = transactions.map(tx => ({
      ...tx,
      timestamp: tx.timestamp || Math.floor(Date.now() / 1000),
      risk_score: tx.risk_score || 0,
      risk_level: tx.risk_level || 'LOW',
      signals: tx.signals || [],
      explanation: tx.explanation || '',
      status: 'confirmed',
    }));

    await db.collection('bitcoin_transactions').insertMany(docs);

    // Emit new transactions via socket
    for (const doc of docs) {
      io.emit('bitcoin:newTransaction', doc);
    }

    res.status(201).json({
      ingested: docs.length,
      message: `Successfully ingested ${docs.length} transactions`
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

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await connectToMongo();
});

export default app;