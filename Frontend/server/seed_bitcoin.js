import crypto from 'crypto';

// GeoIP lookup table (bundled — mirrors the Python backend)
const GEOIP_TABLE = [
  { country: 'US', asn: 'AS15169', label: 'Google LLC',       ip_prefix: '34.' },
  { country: 'US', asn: 'AS16509', label: 'Amazon AWS',       ip_prefix: '54.' },
  { country: 'DE', asn: 'AS24940', label: 'Hetzner Online',   ip_prefix: '95.216.' },
  { country: 'NL', asn: 'AS60781', label: 'LeaseWeb NL',      ip_prefix: '178.162.' },
  { country: 'RU', asn: 'AS49505', label: 'Selectel RU',      ip_prefix: '185.22.' },
  { country: 'CN', asn: 'AS45090', label: 'Shenzhen Tencent', ip_prefix: '119.29.' },
  { country: 'SG', asn: 'AS16509', label: 'AWS Singapore',    ip_prefix: '13.250.' },
  { country: 'GB', asn: 'AS20473', label: 'Vultr London',     ip_prefix: '45.63.' },
  { country: 'JP', asn: 'AS2519',  label: 'ARTERIA Networks', ip_prefix: '163.44.' },
  { country: 'RO', asn: 'AS9009',  label: 'M247 Ltd',         ip_prefix: '185.56.' },
  { country: 'XX', asn: 'AS0',     label: 'Tor Exit Node',    ip_prefix: '10.255.' },
  { country: 'IN', asn: 'AS55836', label: 'Reliance Jio',     ip_prefix: '49.36.' },
  { country: 'BR', asn: 'AS28573', label: 'Claro SA',         ip_prefix: '189.1.' },
];

function randomIP(geoEntry) {
  const g = geoEntry || GEOIP_TABLE[Math.floor(Math.random() * GEOIP_TABLE.length)];
  const parts = g.ip_prefix.replace(/\.$/, '').split('.');
  while (parts.length < 4) parts.push(String(Math.floor(Math.random() * 254) + 1));
  return { ip: parts.slice(0, 4).join('.'), country: g.country, asn: g.asn };
}

/**
 * Seed Bitcoin demo data.
 *
 * @param {import('mongodb').Db} db - Connected database handle (no standalone connection).
 * @param {boolean} force - If true, drop existing data and reseed. Destructive — should
 *   never be triggered by an ordinary restart.
 */
export async function seedBitcoinDatabase(db, force = false) {
  const blockCol = db.collection('bitcoin_blocks');
  const txCol = db.collection('bitcoin_transactions');
  const entityCol = db.collection('bitcoin_entities');
  const riskCol = db.collection('bitcoin_risk_events');
  const invCol = db.collection('bitcoin_investigations');
  const ipCorCol = db.collection('bitcoin_ip_correlations');

  const existingTxs = await txCol.countDocuments();
  if (!force && existingTxs > 0) {
    console.log(`Bitcoin data already seeded (${existingTxs} transactions). Skipping seed.`);
    return;
  }

  if (force) {
    await blockCol.deleteMany({});
    await txCol.deleteMany({});
    await entityCol.deleteMany({});
    await riskCol.deleteMany({});
    await invCol.deleteMany({});
    await ipCorCol.deleteMany({});
    console.log('Cleared existing Bitcoin collections.');
  }

  console.log('⚡ Seeding Bitcoin blocks, transactions, entities, and risk leads...');

  const sampleAddresses = [
    "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
    "bc1q9d4j20f28euehwh3k7e2x9v48q983dhh484d8s",
    "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",
    "bc1p5d7rjq7g6rd2ee07nvz5fqxs5zj0qq7587tw4w",
    "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
    "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    "3FZbgi29cpjq2GjdwV8eyHuJJnkLtktZc5",
    "bc1qgdjqv0av3q56jvd82tkdjpy7gdp9ut8tlqmgrpmv24sq90ecnvqqjwvw97",
    "1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp",
    "bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h",
    "3Kzh9qAqVWQhEsfQz7zEQL1EuSx5tyNLNS"
  ];

  // Create 15 entities with varying risk profiles
  const entities = [];
  const archetypes = [
    'illicit', 'illicit', 'illicit', 'suspicious', 'suspicious',
    'suspicious', 'normal', 'normal', 'normal', 'normal',
    'normal', 'normal', 'normal', 'normal', 'normal'
  ];

  for (let i = 0; i < 15; i++) {
    const eid = `ENT_BTC_${String(i + 1).padStart(3, '0')}`;
    const archetype = archetypes[i];
    const isIllicit = archetype === 'illicit';
    const isSuspicious = archetype === 'suspicious';
    const isHighRisk = isIllicit || isSuspicious;

    const geo = isIllicit
      ? GEOIP_TABLE.find(g => g.country === 'XX') || GEOIP_TABLE[10]
      : GEOIP_TABLE[i % GEOIP_TABLE.length];
    const ipInfo = randomIP(geo);

    const score = isIllicit ? 80 + Math.floor(Math.random() * 15)
                : isSuspicious ? 50 + Math.floor(Math.random() * 25)
                : 5 + Math.floor(Math.random() * 25);

    entities.push({
      entity_id: eid,
      label: `${archetype.charAt(0).toUpperCase() + archetype.slice(1)} Entity #${i + 1}`,
      primary_address: sampleAddresses[i % sampleAddresses.length],
      addresses: [sampleAddresses[i % sampleAddresses.length], sampleAddresses[(i + 3) % sampleAddresses.length]],
      first_seen: '2024-01-10T08:00:00Z',
      last_seen: new Date().toISOString(),
      tx_count: isHighRisk ? 142 + i * 10 : 15 + i * 3,
      total_received_btc: parseFloat((isHighRisk ? 45.8 + i * 12.3 : 2.4 + i * 0.8).toFixed(4)),
      total_sent_btc: parseFloat((isHighRisk ? 44.1 + i * 11.9 : 2.1 + i * 0.7).toFixed(4)),
      balance_btc: parseFloat((0.2 + i * 0.1).toFixed(4)),
      velocity_1h: isIllicit ? 12.4 : (isSuspicious ? 6.2 : 1.2),
      velocity_24h: isIllicit ? 58.0 : (isSuspicious ? 24.0 : 4.5),
      unique_counterparties: isHighRisk ? 68 + i * 5 : 8 + i,
      cluster_id: isIllicit ? 2 : (isSuspicious ? 1 : 0),
      cluster_description: isIllicit ? 'High-velocity fast-layering & CoinJoin mixing'
                          : isSuspicious ? 'Elevated velocity with peel-chain indicators'
                          : 'Standard merchant & retail flows',
      risk_score: score,
      risk_level: score >= 75 ? 'CRITICAL' : (score >= 50 ? 'HIGH' : (score >= 25 ? 'MEDIUM' : 'LOW')),
      pagerank: isHighRisk ? 0.0124 + i * 0.001 : 0.0018,
      // Network-layer fields
      geo_countries: [ipInfo.country],
      unique_ips: isHighRisk ? 8 + i : 2,
      anonymity_score: isIllicit ? 0.85 : (isSuspicious ? 0.35 : 0.05),
      cross_entity_links: isIllicit ? 3 : (isSuspicious ? 1 : 0),
      propagated_risk: isIllicit ? 1.0 : (isSuspicious ? 0.42 : 0.0),
      is_seed_illicit: isIllicit,
    });
  }

  const blocks = [];
  const transactions = [];
  const riskEvents = [];

  const baseHeight = 840250;
  const now = Math.floor(Date.now() / 1000);

  // Generate 25 blocks with 20 transactions each = 500 transactions
  const PATTERNS = ['normal', 'peel_chain', 'coinjoin', 'fan_in', 'fan_out', 'rapid_forwarding'];

  for (let b = 0; b < 25; b++) {
    const height = baseHeight - b;
    const blockTime = now - b * 600;
    const blockHash = crypto.createHash('sha256').update(`block_${height}`).digest('hex');

    blocks.push({
      height,
      hash: blockHash,
      time: blockTime,
      timestamp: new Date(blockTime * 1000).toISOString(),
      tx_count: 20,
      size: 1420500 + Math.floor(Math.random() * 200000),
      difficulty: 83145000000000,
      status: 'confirmed'
    });

    for (let t = 0; t < 20; t++) {
      const txid = crypto.createHash('sha256').update(`tx_${height}_${t}`).digest('hex');
      const entity = entities[(b * 3 + t) % entities.length];
      const isAnom = entity.risk_score >= 50;
      const amount = parseFloat((isAnom ? 2.5 + Math.random() * 15 : 0.05 + Math.random() * 1.5).toFixed(6));
      const fee = parseFloat((0.00008 + Math.random() * 0.0003).toFixed(6));

      const inAddr = entity.addresses[0];
      const outAddr = sampleAddresses[(t + 1) % sampleAddresses.length];
      const changeAddr = entity.addresses[1] || inAddr;

      // Determine pattern
      let pattern = 'normal';
      let input_count = 1, output_count = 2;
      if (isAnom) {
        const pIdx = (b + t) % 5;
        if (pIdx === 0) { pattern = 'peel_chain'; input_count = 1; output_count = 2; }
        else if (pIdx === 1) { pattern = 'coinjoin'; input_count = 5 + (t % 8); output_count = 5 + (t % 8) + 2; }
        else if (pIdx === 2) { pattern = 'fan_in'; input_count = 6 + (t % 10); output_count = 1; }
        else if (pIdx === 3) { pattern = 'fan_out'; input_count = 1; output_count = 10 + (t % 8); }
        else { pattern = 'rapid_forwarding'; input_count = 1; output_count = 1; }
      }

      // Network-layer data
      const srcGeo = entity.is_seed_illicit
        ? GEOIP_TABLE.find(g => g.country === 'XX') || GEOIP_TABLE[0]
        : GEOIP_TABLE[(b + t) % GEOIP_TABLE.length];
      const dstGeo = GEOIP_TABLE[(b + t + 3) % GEOIP_TABLE.length];
      const srcIP = randomIP(srcGeo);
      const dstIP = randomIP(dstGeo);

      const signals = [];
      const explanations = [];

      if (pattern === 'peel_chain') {
        signals.push('peel_chain_pattern', 'rapid_forwarding');
        explanations.push(`Peel-chain structural pattern detected with asymmetric change split.`);
      } else if (pattern === 'coinjoin') {
        signals.push('coinjoin_structure', 'coinjoin_high_participant');
        explanations.push(`CoinJoin-like structure with ${input_count} inputs and ${output_count} equal-value outputs.`);
      } else if (pattern === 'fan_in') {
        signals.push('fan_in_consolidation');
        explanations.push(`Fan-in consolidation: ${input_count} inputs funneled to ${output_count} output.`);
      } else if (pattern === 'fan_out') {
        signals.push('fan_out_dispersion');
        explanations.push(`Fan-out dispersion: ${input_count} input split to ${output_count} outputs.`);
      } else if (pattern === 'rapid_forwarding') {
        signals.push('rapid_forwarding', 'velocity_spike');
        explanations.push(`Rapid forwarding with sub-minute inter-transaction interval.`);
      } else {
        explanations.push('Transaction parameters match standard baseline behaviors.');
      }

      if (entity.is_seed_illicit) {
        signals.push('tor_exit_node', 'anonymized_origin');
        explanations.push(`Relayed via Tor exit node (${srcIP.ip}).`);
      }

      const txDoc = {
        txid,
        block_height: height,
        block_hash: blockHash,
        timestamp: blockTime,
        date: new Date(blockTime * 1000).toISOString().split('T')[0],
        time: new Date(blockTime * 1000).toTimeString().split(' ')[0],
        version: 2,
        size: 245,
        vsize: 180,
        weight: 720,
        entity_id: entity.entity_id,
        input_count,
        output_count,
        total_input_btc: parseFloat((amount + fee).toFixed(6)),
        total_output_btc: amount,
        fee_btc: fee,
        inputs: [{
          prev_txid: crypto.createHash('sha256').update(`prev_${txid}`).digest('hex'),
          prev_vout: 0,
          value_btc: parseFloat((amount + fee).toFixed(6)),
          script_type: 'P2WPKH',
          address: inAddr
        }],
        outputs: [
          { vout: 0, value_btc: parseFloat((amount * 0.85).toFixed(6)), script_type: 'P2WPKH', address: outAddr, is_op_return: false },
          { vout: 1, value_btc: parseFloat((amount * 0.15).toFixed(6)), script_type: 'P2WPKH', address: changeAddr, is_op_return: false }
        ],
        input_addresses: [inAddr],
        output_addresses: [outAddr, changeAddr],
        risk_score: entity.risk_score,
        risk_level: entity.risk_level,
        signals,
        explanation: explanations.join(' '),
        cluster_id: entity.cluster_id,
        pattern,
        status: 'confirmed',
        // Network-layer fields
        src_ip: srcIP.ip,
        dst_ip: dstIP.ip,
        src_port: 8333,
        dst_port: 8333,
        geo_country: srcIP.country,
        asn: srcGeo.asn,
        is_coinjoin: pattern === 'coinjoin',
        mixing_score: pattern === 'coinjoin' ? 0.78 : 0.0,
        propagated_risk: entity.propagated_risk || 0,
        ip_anonymity_score: entity.anonymity_score || 0,
      };

      transactions.push(txDoc);

      if (isAnom) {
        riskEvents.push({
          lead_id: `LEAD_${txid.slice(0, 10).toUpperCase()}`,
          txid,
          entity_id: entity.entity_id,
          risk_score: entity.risk_score,
          risk_level: entity.risk_level,
          signals,
          explanation: txDoc.explanation,
          pattern,
          propagated_risk: entity.propagated_risk || 0,
          geo_country: srcIP.country,
          timestamp: blockTime,
          created_at: new Date(blockTime * 1000).toISOString()
        });
      }
    }
  }

  // GeoIP correlation stats
  const geoCountMap = {};
  for (const tx of transactions) {
    const c = tx.geo_country || 'UNKNOWN';
    if (!geoCountMap[c]) geoCountMap[c] = { country: c, tx_count: 0, btc_volume: 0 };
    geoCountMap[c].tx_count++;
    geoCountMap[c].btc_volume += tx.total_output_btc || 0;
  }
  const geoStats = Object.values(geoCountMap).map(g => ({
    ...g,
    btc_volume: parseFloat(g.btc_volume.toFixed(4))
  }));

  // Pre-seed investigations
  const investigations = [
    {
      investigation_id: 'INV-2026-001',
      title: 'High-Velocity Peel-Chain Entity ENT_BTC_001',
      description: 'Multiple rapid forwardings detected through P2WPKH addresses with asymmetrical change splits. Entity relays through Tor exit nodes.',
      priority: 'CRITICAL',
      status: 'UNDER_REVIEW',
      risk_score: 92,
      created_by: 'Lead Investigator',
      created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      entities: ['ENT_BTC_001'],
      transactions: [transactions[0]?.txid || ''],
      notes: 'Monitored 142 hops over a 24-hour cycle. High correlation with mixer-like dispersion motif. All relay IPs are Tor exit nodes.'
    },
    {
      investigation_id: 'INV-2026-002',
      title: 'CoinJoin Mixing Cluster ENT_BTC_002',
      description: 'Entity participates in CoinJoin transactions with 5-15 equal-value outputs, consistent with Wasabi/Whirlpool mixing.',
      priority: 'HIGH',
      status: 'OPEN',
      risk_score: 85,
      created_by: 'Analyst Vinith',
      created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
      entities: ['ENT_BTC_002'],
      transactions: [transactions[2]?.txid || ''],
      notes: 'CoinJoin pattern score 0.78. Cross-entity IP reuse detected with ENT_BTC_003.'
    },
    {
      investigation_id: 'INV-2026-003',
      title: 'Dormant Whale Awakening ENT_BTC_003',
      description: 'UTXOs dormant for over 18 months spent within sub-minute burst intervals via VPN infrastructure.',
      priority: 'HIGH',
      status: 'OPEN',
      risk_score: 78,
      created_by: 'Analyst Vinith',
      created_at: new Date(Date.now() - 3600000 * 36).toISOString(),
      entities: ['ENT_BTC_003'],
      transactions: [transactions[4]?.txid || ''],
      notes: 'Initial hop routed to 4 new Taproot addresses. All relay IPs on hosting provider (M247 Ltd, Romania).'
    }
  ];

  const markFixture = records => records.map(record => ({
    ...record,
    data_mode: 'SIMULATION',
    data_source: 'seed_bitcoin.js synthetic demo fixture'
  }));
  await blockCol.insertMany(markFixture(blocks));
  await txCol.insertMany(markFixture(transactions));
  await entityCol.insertMany(markFixture(entities));
  if (riskEvents.length > 0) await riskCol.insertMany(markFixture(riskEvents));
  await invCol.insertMany(markFixture(investigations));
  if (geoStats.length > 0) await ipCorCol.insertMany(markFixture(geoStats));

  console.log(`✅ Seeded ${blocks.length} blocks, ${transactions.length} txs, ${entities.length} entities, ${riskEvents.length} risk leads, ${investigations.length} investigations, ${geoStats.length} geo records.`);
}

// CLI standalone execution (for manual destructive reseed only)
if (process.argv[1] && process.argv[1].includes('seed_bitcoin.js')) {
  const { MongoClient } = await import('mongodb');
  const mongoURL = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
  const dbName = process.env.MONGO_DB_NAME || 'RedisTransactions';
  const client = new MongoClient(mongoURL);
  await client.connect();
  console.log('WARNING: Running destructive Bitcoin reseed via CLI.');
  await seedBitcoinDatabase(client.db(dbName), true);
  await client.close();
  console.log('Bitcoin seed complete.');
  process.exit(0);
}
