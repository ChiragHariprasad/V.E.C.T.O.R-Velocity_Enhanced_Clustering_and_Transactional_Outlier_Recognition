# V.E.C.T.O.R — HARDCODED DATA AUDIT

> All hardcoded, static, placeholder, and demo values identified in the codebase

---

## Critical — Misleading to Users

### HC-1: Status Endpoint — Hardcoded Health Indicators
- **File**: [index.js:191-195](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Frontend/server/index.js#L191-L195)
- **Values**:
  ```javascript
  network: 'regtest',           // Always "regtest"
  node_status: 'connected',     // Always "connected" even without Bitcoin Core
  model_status: 'operational',  // Always "operational" even without trained models
  tps: 18.5,                    // Static — not measured
  model_latency_ms: 12.4        // Static — not measured
  ```
- **Impact**: Dashboard Pipeline Telemetry panel shows fake health metrics
- **Fix**: Compute TPS from `(txs_processed / elapsed_seconds)` during bulk ingest; check actual Bitcoin RPC connectivity; track ML inference time

### HC-2: Clusters Endpoint — Entirely Fabricated
- **File**: [index.js:498-528](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Frontend/server/index.js#L498-L528)
- **Values**: 3 hardcoded cluster objects with static entity counts, volumes, velocities
- **Impact**: Behavioral Clusters page displays fictional data
- **Fix**: Compute actual clusters using HDBSCAN on entity feature vectors (library is already installed)

### HC-3: ML Score — Fixed Baseline
- **File**: [bulk_ingest.py:324](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Backend/bitcoin/bulk_ingest.py#L324)
- **Value**: `ml_score = 0.15` (boosted by propagated risk or illicit label)
- **Impact**: The ML component of risk scoring is not actually from ML inference
- **Fix**: Train Isolation Forest on the 50+ feature vectors and load model.pkl

---

## Moderate — Affects Accuracy

### HC-4: Feature Engine — 5 Static Feature Placeholders
- **File**: [bitcoin_features.py:142-191](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Backend/bitcoin/bitcoin_features.py#L142-L191)
- **Values**:
  | Feature | Static Value |
  |---|---|
  | `activity_periodicity` | 0.5 |
  | `counterparty_concentration` | 0.45 |
  | `repeated_counterparty_ratio` | 0.2 |
  | `counterparty_deviation` | 0.15 |
  | `temporal_deviation` | 0.20 |

### HC-5: Total Sent BTC — Fixed Ratio
- **File**: [bitcoin_features.py:112](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Backend/bitcoin/bitcoin_features.py#L112)
- **Value**: `total_sent_btc = total_received * 0.95`
- **Impact**: Not computed from actual sends

### HC-6: Block Height in Bulk Ingest
- **File**: [bulk_ingest.py:176](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Backend/bitcoin/bulk_ingest.py#L176)
- **Value**: `block_height: 840000` for all normalized rows
- **Impact**: All transactions share same block height

### HC-7: Wallet Analysis — Empty Behavior Fields
- **File**: [index.js:305-309](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Frontend/server/index.js#L305-L309)
- **Values**: `velocity_1h: 0, velocity_24h: 0, total_volume_btc: 0, avg_tx_value: 0`
- **Cause**: Entity documents don't store these fields; they're computed in Python but not persisted

### HC-8: Artificial Analysis Delay
- **File**: [index.js:328](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Frontend/server/index.js#L328)
- **Value**: `setTimeout(() => res.json(intelligence), 1500)`
- **Impact**: 1.5-second fake delay on every wallet analysis

### HC-9: Search Entity Prefix Mismatch
- **File**: [index.js:231](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Frontend/server/index.js#L231)
- **Value**: `const isEntity = query.startsWith('ENT_BTC_')`
- **Impact**: Only matches seed-style entities. Bulk-ingested entities use `ENT_XXXXXXXXXXXX` format and won't trigger entity-specific search path

---

## Low — Known Limitations

### HC-10: RPC Mock Fallback Block Height
- **File**: [rpc_client.py:44](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Backend/bitcoin/rpc_client.py#L44)
- **Value**: `self._mock_height = 840100`
- **Context**: Expected — simulation mode for dev without Bitcoin Core

### HC-11: GeoIP Prefix Table
- **File**: [ip_correlator.py:20-43](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Backend/bitcoin/ip_correlator.py#L20-L43)
- **Value**: 22-entry static prefix-to-country mapping
- **Context**: Known limitation — production would use MaxMind GeoLite2

### HC-12: Geo Stats Static Fallback
- **File**: [index.js:703-715](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Frontend/server/index.js#L703-L715)
- **Value**: 10 static country records (only used if IP correlator AND aggregation return empty)
- **Context**: After bulk ingest, real data is used — fallback is never triggered

### HC-13: CORS Origin Hardcoded
- **File**: [index.js:13](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Frontend/server/index.js#L13)
- **Value**: `origin: 'http://localhost:5173'`
- **Impact**: Socket.IO CORS may fail when Vite auto-picks port 5174

### HC-14: Default Bitcoin Context Status
- **File**: [BitcoinContext.tsx:58-71](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Frontend/src/context/BitcoinContext.tsx#L58-L71)
- **Value**: Default status object with all zeros (used before first API call completes)
- **Context**: Normal React pattern — immediately replaced by API data
