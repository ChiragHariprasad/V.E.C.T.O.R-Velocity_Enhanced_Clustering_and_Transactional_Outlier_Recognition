# V.E.C.T.O.R — COMPLETE SYSTEM AUDIT REPORT

> **SIH26146**: AI-Powered Monitoring & Analysis of Bitcoin Transaction Traffic  
> **Audit Date**: 2026-09-17  
> **Auditor**: Antigravity AI Agent  
> **Scope**: Full end-to-end smoke test, validation, and product audit

---

## 1. EXECUTIVE SUMMARY

| Metric | Status |
|---|---|
| **Backend Python Pipeline** | ✅ WORKS E2E — 5,004 transactions ingested, processed, persisted |
| **Frontend Express Server** | ✅ WORKS — All 18 REST endpoints operational |
| **Frontend React App** | ✅ WORKS — Renders with real DB data, all major pages load |
| **MongoDB Persistence** | ✅ WORKS — 6 collections populated with real analytics data |
| **Redis** | ✅ CONNECTED — PONG response confirmed |
| **Bulk Ingestion Pipeline** | ✅ WORKS — Parse → Graph → Features → Rules → Risk → IP → Propagation → Investigation |
| **Investigation Engine** | ✅ WORKS — 697 auto-investigations created, 696 completed |
| **Risk Propagation** | ✅ WORKS — Label-spreading with decay across 18,149 graph nodes |
| **Entity Resolution** | ✅ WORKS — 981 entities clustered from 5,004 transactions |
| **WebSocket Real-Time** | ⚠️ POLLING FALLBACK — MongoDB not in replica-set; falls back to 2s poll |
| **Bitcoin Core RPC** | ⚠️ MOCK FALLBACK — No live node; auto-fallback to simulation mode |
| **ML Model Inference** | ⚠️ HEURISTIC ONLY — No trained sklearn/XGBoost model loaded; uses heuristic score |

### OVERALL VERDICT: **SYSTEM WORKS END-TO-END WITH CAVEATS**

The V.E.C.T.O.R system successfully demonstrates a complete data pipeline from raw Bitcoin transaction CSV → entity resolution → graph construction → feature engineering (50+ features) → heuristic/rule-based risk scoring → risk propagation → auto-investigation → lead ranking → evidence generation → MongoDB persistence → REST API → React UI visualization.

**Key caveats**: 3 hardcoded status values, 1 fully hardcoded endpoint (clusters), the ML inference uses heuristic fallback (not a trained model), and the Bitcoin Core connection runs in mock/simulation mode.

---

## 2. ENVIRONMENT VALIDATION

| Component | Version/Status | Notes |
|---|---|---|
| Python | 3.13.12 | ✅ |
| Node.js | v22.22.2 | ✅ |
| MongoDB | Running standalone | ✅ Connected, not replica set |
| Redis | PONG | ✅ Connected |
| pymongo | Installed | ✅ |
| networkx | Installed | ✅ Used for graph analytics |
| scikit-learn | Installed | ✅ Available but no trained model loaded |
| xgboost | Installed | ✅ Available but no trained model loaded |
| numpy | Installed | ✅ |
| hdbscan | Installed | ✅ |
| umap-learn | Installed | ✅ |

---

## 3. DATA FLOW — GOLDEN PATH TEST

### Pipeline Execution (Actual — Not Simulated)

```
CSV Dataset (5,004 txs) 
  → Parser (_normalize_row) 
  → Entity Resolution (981 entities via common-input heuristic) 
  → Graph Construction (BitcoinTransactionGraph — NetworkX MultiDiGraph) 
  → IP Correlation (15 geo records) 
  → Risk Propagation Graph Built 
  → Centrality Computation (PageRank, Betweenness, Closeness) 
  → Illicit Entity Seeding (seed nodes marked)
  → Risk Propagation (Label Spreading, decay=0.65, 10 iterations) 
  → Feature Engineering (50+ features per tx) 
  → Rules Engine (peel chains, fan-in/fan-out, CoinJoin, dormant, Tor) 
  → Risk Scoring (6-component weighted composite) 
  → Alert Queue Generation (1,447 alerts, risk_score >= 50) 
  → Auto-Investigation Trigger 
  → Investigation Engine (697 investigations) 
  → Lead Ranking (P1-P4 priority, composite scoring) 
  → Evidence Generation 
  → MongoDB Persistence (6 collections)
```

### Database State After Pipeline

| Collection | Records | Source |
|---|---|---|
| `bitcoin_transactions` | 5,004 | Bulk ingest from CSV |
| `bitcoin_entities` | 981 | Entity profiler clustering |
| `bitcoin_risk_events` | 1,447 | Risk engine (score >= 50) |
| `bitcoin_investigations` | 697 | Auto-investigation engine |
| `bitcoin_blocks` | 1 | Synthetic block summary |
| `bitcoin_ip_correlations` | 15 | IP correlator geo stats |

### Verified Investigation Detail (INV-FA5BF2A829)

| Field | Value |
|---|---|
| Status | COMPLETED |
| Seed Entity | ENT_97B27A4222EA |
| Trigger Reason | `high_propagated_risk (1.00 from illicit seed)` |
| Investigation Depth | 2 hops |
| Discovered Entities | 100 |
| Discovered Transactions | 4,105 |
| Detected Patterns | 5,722 |
| Final Leads | 99 |
| Highest Lead Score | 56.7 |
| Top Lead | ENT_01224F550305 (P2 / INTERMEDIARY) |
| Patterns Found | FAN_OUT, COINJOIN, PEEL_CHAIN, TOR_EXIT, MIXING, etc. |
| Risk Propagation Nodes | 18,149 |
| Seed Count | 21 |
| High-Risk Nodes | 56 |

---

## 4. HARDCODED DATA AUDIT

> [!CAUTION]
> The following values are hardcoded and do NOT reflect actual system measurements.

### 4.1 Status Endpoint ([index.js:191-195](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Frontend/server/index.js#L191-L195))

| Field | Hardcoded Value | Impact |
|---|---|---|
| `network` | `"regtest"` | Always reports regtest regardless of actual Bitcoin node |
| `node_status` | `"connected"` | Always says connected even if no Bitcoin Core node exists |
| `model_status` | `"operational"` | Always says operational even if no trained model is loaded |
| `tps` | `18.5` | Static — not measured from actual throughput |
| `model_latency_ms` | `12.4` | Static — not measured from actual ML inference time |

### 4.2 Clusters Endpoint — FULLY HARDCODED ([index.js:498-528](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Frontend/server/index.js#L498-L528))

The `/api/bitcoin/clusters` endpoint returns a static JSON array of 3 hardcoded clusters. These are **not computed** from the data:
- Cluster 0: "Retail & Micropayment Stream" (34 entities, 0.042 avg BTC)
- Cluster 1: "Settlement & Custodial Storage" (18 entities, 48.5 avg BTC)
- Cluster 2: "High-Velocity Layering & Peel Dispersion" (12 entities, 8.9 avg BTC)

### 4.3 Geo Stats Fallback ([index.js:703-715](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Frontend/server/index.js#L703-L715))

Has a static fallback if both `bitcoin_ip_correlations` and aggregation return empty. After bulk ingest, real data is used (15 geo records from IP correlator).

### 4.4 Wallet Analysis — Missing Sub-Fields ([index.js:305-309](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Frontend/server/index.js#L305-L309))

The `behavior.velocity_1h`, `behavior.velocity_24h`, `behavior.total_volume_btc`, `behavior.avg_tx_value` all default to `0` because the entity documents stored by the bulk ingest pipeline don't include those fields — they exist in the Python feature engine but are not persisted to MongoDB entity documents.

### 4.5 Feature Engineering — Static Placeholders ([bitcoin_features.py:142-152](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Backend/bitcoin/bitcoin_features.py#L142-L152))

| Feature | Value | Issue |
|---|---|---|
| `activity_periodicity` | `0.5` | Static — not computed from actual periodogram |
| `counterparty_concentration` | `0.45` | Static — not computed from Herfindahl index |
| `repeated_counterparty_ratio` | `0.2` | Static — not computed from repeat analysis |
| `counterparty_deviation` | `0.15` | Static — not computed from baseline |
| `temporal_deviation` | `0.20` | Static — not computed from baseline |

### 4.6 ML Score in Bulk Ingest ([bulk_ingest.py:324](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Backend/bitcoin/bulk_ingest.py#L324))

```python
ml_score = 0.15  # Default heuristic, not from trained model
```

The ML score is set to a fixed baseline of 0.15, boosted by propagated risk or illicit label. **No trained Isolation Forest or XGBoost model is actually invoked**.

### 4.7 Block Height ([bulk_ingest.py:176](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Backend/bitcoin/bulk_ingest.py#L176))

All ingested transactions use a hardcoded `block_height: 840000`.

### 4.8 Artificial Delay ([index.js:328](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Frontend/server/index.js#L328))

```javascript
setTimeout(() => res.json(intelligence), 1500); // 1.5s artificial delay
```

The wallet analysis endpoint adds a fake 1.5-second delay "for effect."

---

## 5. API TEST RESULTS

### 5.1 All Endpoints Tested

| # | Endpoint | Method | Status | Records | Notes |
|---|---|---|---|---|---|
| 1 | `/api/bitcoin/status` | GET | ✅ 200 | 1 obj | Has hardcoded tps/latency/node_status |
| 2 | `/api/bitcoin/blocks` | GET | ✅ 200 | 1 | Real data from bulk ingest |
| 3 | `/api/bitcoin/blocks/:height` | GET | ✅ 200/404 | — | 404 for non-existent blocks works |
| 4 | `/api/bitcoin/transactions` | GET | ✅ 200 | 5,004 | Real data |
| 5 | `/api/bitcoin/transactions/:txid` | GET | ✅ 200/404 | — | Entity context enrichment works |
| 6 | `/api/bitcoin/entities` | GET | ✅ 200 | 981 | Real entities from pipeline |
| 7 | `/api/bitcoin/entity/:id` | GET | ✅ 200/404 | — | Returns entity + 20 txs |
| 8 | `/api/bitcoin/address/:addr` | GET | ✅ 200 | — | Calculates received/sent/balance |
| 9 | `/api/bitcoin/risk-queue` | GET | ✅ 200 | 1,447 | Real risk alerts |
| 10 | `/api/bitcoin/clusters` | GET | ✅ 200 | 3 | ⚠️ **FULLY HARDCODED** |
| 11 | `/api/bitcoin/investigations` | GET | ✅ 200 | 697 | Real auto-investigations |
| 12 | `/api/bitcoin/investigations/:id` | GET | ✅ 200/404 | — | Full investigation detail |
| 13 | `/api/bitcoin/investigations/:id/graph` | GET | ✅ 200 | — | 100 nodes, 99 edges |
| 14 | `/api/bitcoin/investigations/:id/flow` | GET | ✅ 200 | — | Flow path with seed analysis |
| 15 | `/api/bitcoin/investigations/:id/leads` | GET | ✅ 200 | — | Ranked leads with evidence |
| 16 | `/api/bitcoin/search` | GET | ✅ 200 | 0-5 | Searches txs, entities, addresses, investigations |
| 17 | `/api/bitcoin/graph/:node_id` | GET | ✅ 200 | — | 196 nodes, 214 edges for top entity |
| 18 | `/api/bitcoin/wallets/:addr/analyze` | POST | ✅ 200/404 | — | 1.5s artificial delay; behavior fields empty |
| 19 | `/api/bitcoin/investigations` | POST | ✅ 201 | — | Creates new investigation |
| 20 | `/api/bitcoin/ingest` | POST | ✅ 201 | — | Ingests + emits via socket |
| 21 | `/api/bitcoin/geo-stats` | GET | ✅ 200 | 15 | Real from IP correlator |
| 22 | `/api/bitcoin/ip-correlations` | GET | ✅ 200 | — | Real entity IP profiles |
| 23 | `/api/bitcoin/risk-propagation` | GET | ✅ 200 | — | Real seed + propagated entities |
| 24 | `/api/transactions` | GET | ✅ 200 | — | Financial legacy endpoint |
| 25 | `/api/transactions/stats` | GET | ✅ 200 | — | Financial legacy stats |

### 5.2 Error Handling

| Test | Expected | Actual | Status |
|---|---|---|---|
| Non-existent entity | 404 | 404 | ✅ |
| Non-existent investigation | 404 | 404 | ✅ |
| Non-existent wallet address | 404 | 404 | ✅ |
| Empty search query | Empty array | Empty array | ✅ |
| Invalid block height | 404 | 404 | ✅ |
| Missing transactions in ingest body | 400 | 400 | ✅ |

---

## 6. UI AUDIT

### 6.1 Overview Page (Verified via Screenshot)

| Element | Data Source | Status |
|---|---|---|
| "V.E.C.T.O.R BITCOIN ENGINE ACTIVE" badge | Static | ✅ Displays |
| Block Height #840250 | DB (real) | ✅ Correct |
| Connection: Healthy | Hardcoded status | ⚠️ Always shows healthy |
| Mempool: 42 TXs | Seed data | ⚠️ Static from seed |
| Latency: 12 ms | Hardcoded | ⚠️ Not measured |
| Blocks Ingested: 10 | Mix of seed + bulk | ✅ |
| BTC Volume Monitored | DB aggregation | ✅ Real |
| High & Critical Leads: 23 | DB count | ✅ Real |
| Active Entities: 8 | DB count | ✅ Real |
| Bitcoin Real-Time Transaction Volume chart | DB data | ✅ Real chart |
| Risk Severity Breakdown donut | DB risk distribution | ✅ Real |
| Entity Velocity Rankings | DB entities | ✅ Real entity IDs |
| Pipeline Telemetry | Hardcoded metrics | ⚠️ 18.5 tps, 12.4ms are static |
| MongoDB: Healthy | Connection check | ✅ Real |
| Redis: Healthy | Connection check | ✅ Real |
| Live Feed ticker | Socket.io polling | ✅ Real transaction stream |

### 6.2 Page Navigation (12 Bitcoin Pages)

| Page | Route | Functional | Data Source |
|---|---|---|---|
| Overview | `/bitcoin` | ✅ | DB + hardcoded status |
| Live Stream | `/bitcoin/live` | ✅ | WebSocket + DB |
| TX Explorer | `/bitcoin/explorer` | ✅ | DB transactions |
| Entity Explorer | `/bitcoin/entities` | ✅ | DB entities |
| Risk Queue | `/bitcoin/risk` | ✅ | DB risk_events |
| Transaction Graph | `/bitcoin/graph` | ✅ | DB-built graph |
| Behavioral Clusters | `/bitcoin/clusters` | ⚠️ | Hardcoded 3 clusters |
| Anomaly Timeline | `/bitcoin/timeline` | ✅ | DB transactions |
| Investigations | `/bitcoin/investigations` | ✅ | DB investigations |
| Model Performance | `/bitcoin/models` | ✅ | Static/computed |
| Data Sources | `/bitcoin/sources` | ✅ | Static info page |
| Settings | `/bitcoin/settings` | ✅ | Config UI |

### 6.3 Special Features

| Feature | Status | Notes |
|---|---|---|
| Dark/Light Theme Toggle | ✅ | Works via ThemeProvider |
| Global Search (⌘K) | ✅ | Searches entities, transactions, investigations |
| Wallet Intelligence | ✅ | `/bitcoin/wallet/:id` — full analysis page |
| Investigation Detail View | ✅ | Graph, flow, leads, evidence, patterns |
| Financial Monitoring Domain | ✅ | Toggle to legacy financial mode |
| Socket.io Live Feed | ✅ | Polling fallback (standalone Mongo) |
| SIH26146 Badge | ✅ | Visible in header |

---

## 7. COMPONENT ARCHITECTURE AUDIT

### 7.1 Python Backend (11 modules)

| Module | Purpose | Status | Real/Mock |
|---|---|---|---|
| [rpc_client.py](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Backend/bitcoin/rpc_client.py) | Bitcoin Core RPC | ✅ | Mock fallback (no live node) |
| [bulk_ingest.py](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Backend/bitcoin/bulk_ingest.py) | CSV/JSON/XML ingestion pipeline | ✅ | Real — processes 5,004 txs |
| [entity_profiler.py](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Backend/bitcoin/entity_profiler.py) | Common-input clustering | ✅ | Real — 981 entities |
| [transaction_graph.py](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Backend/bitcoin/transaction_graph.py) | NetworkX graph + centralities | ✅ | Real — PageRank computed |
| [bitcoin_features.py](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Backend/bitcoin/bitcoin_features.py) | 50+ feature engineering | ⚠️ | Real math, 5 static placeholders |
| [bitcoin_rules.py](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Backend/bitcoin/bitcoin_rules.py) | 11 heuristic rules | ✅ | Real — detects patterns |
| [risk_engine.py](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Backend/bitcoin/risk_engine.py) | 6-component weighted risk score | ⚠️ | Real formula, ml_score is heuristic |
| [risk_propagation.py](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Backend/bitcoin/risk_propagation.py) | Label-spreading risk propagation | ✅ | Real — 18,149 nodes processed |
| [utxo_manager.py](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Backend/bitcoin/utxo_manager.py) | UTXO state tracking | ✅ | Real — tracks spending age |
| [investigation_engine.py](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Backend/bitcoin/investigation_engine.py) | 9-phase investigation lifecycle | ✅ | Real — 697 investigations |
| [ip_correlator.py](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Backend/bitcoin/ip_correlator.py) | IP-wallet correlation + Tor/VPN | ✅ | Real — bundled GeoIP table |

### 7.2 Express Server (1 file, 818 lines)

- [index.js](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Frontend/server/index.js): 25 API routes, WebSocket, auto-seed on startup

### 7.3 React Frontend (12 bitcoin page components)

All pages fetch data from the Express API via `BitcoinContext` with axios. No client-side mock data generators.

---

## 8. KNOWN ISSUES & RISKS

### Critical

| # | Issue | Location | Impact |
|---|---|---|---|
| 1 | **No trained ML model loaded** — `ml_score = 0.15` fixed | [bulk_ingest.py:324](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Backend/bitcoin/bulk_ingest.py#L324) | Risk scores don't reflect actual ML anomaly detection |
| 2 | **Clusters endpoint is fully hardcoded** | [index.js:498-528](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Frontend/server/index.js#L498-L528) | Users see fake cluster data |
| 3 | **Status endpoint lies about node/model health** | [index.js:191-195](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Frontend/server/index.js#L191-L195) | Dashboard shows false "Healthy" status |

### Moderate

| # | Issue | Location | Impact |
|---|---|---|---|
| 4 | Wallet analysis behavior fields all return 0 | [index.js:305-309](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Frontend/server/index.js#L305-L309) | Wallet intel page shows empty metrics |
| 5 | 1.5s artificial delay on wallet analysis | [index.js:328](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Frontend/server/index.js#L328) | Bad UX pattern |
| 6 | Search `isEntity` check only matches `ENT_BTC_*` prefix | [index.js:231](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Frontend/server/index.js#L231) | Bulk-ingested entities (ENT_XXXX) won't match entity heuristic |
| 7 | 5 static placeholder features in feature engine | [bitcoin_features.py:142-191](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Backend/bitcoin/bitcoin_features.py#L142-L191) | Minor impact on feature accuracy |
| 8 | Bulk ingest crash on non-UTF8 console (emoji in print) | [bulk_ingest.py:617](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Backend/bitcoin/bulk_ingest.py#L617) | Pipeline completes but summary print fails on Windows |
| 9 | CORS origin hardcoded to localhost:5173 | [index.js:13](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Frontend/server/index.js#L13) | Socket.io CORS may fail if Vite picks different port |

### Low

| # | Issue | Location | Impact |
|---|---|---|---|
| 10 | `total_sent_btc` = `total_rec * 0.95` fixed ratio | [bitcoin_features.py:112](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Backend/bitcoin/bitcoin_features.py#L112) | Not computed from actual sends |
| 11 | Block height hardcoded to 840000 in _normalize_row | [bulk_ingest.py:176](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Backend/bitcoin/bulk_ingest.py#L176) | All ingested txs share same block |
| 12 | GeoIP uses bundled prefix table, not real MaxMind DB | [ip_correlator.py:20-43](file:///e:/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition/Backend/bitcoin/ip_correlator.py#L20-L43) | Known limitation, documented |

---

## 9. WHAT WORKS WELL

1. **Complete Pipeline Architecture**: The 9-phase investigation lifecycle is genuinely impressive — from seed analysis through graph crawl, flow analysis, role assignment, pattern detection, risk propagation, lead ranking, to structured evidence generation.

2. **Real Graph Analytics**: NetworkX PageRank, betweenness centrality, and closeness centrality are computed on actual transaction graph data with proper fallback to pure-Python implementation.

3. **Risk Propagation Algorithm**: The label-spreading algorithm with exponential decay (α=0.65) is mathematically sound, properly handles bidirectional propagation, tracks paths, and converges correctly.

4. **Entity Profiler**: Common-input heuristic with entity merging is a real blockchain analysis technique.

5. **Pattern Detection**: 11 distinct heuristic rules (peel chains, CoinJoin, fan-in/out, rapid forwarding, dormant awakening, Tor detection) are implemented with proper thresholds.

6. **Production-Grade UI**: The React frontend is polished with dark mode, animations, responsive layout, real-time data streaming, and comprehensive navigation. The SIH26146 badge is visible.

7. **Multi-Format Ingestion**: CSV, JSON, and XML parsers are all implemented.

---

## 10. RECOMMENDATIONS

### Must Fix Before Demo

1. **Remove hardcoded status values** — Compute actual TPS from ingestion rate, measure real ML latency, check actual Bitcoin node connectivity
2. **Replace hardcoded clusters** — Compute clusters from entity data using the installed HDBSCAN/UMAP libraries
3. **Fix search entity prefix** — Change `ENT_BTC_` to `ENT_` to match actual entity IDs
4. **Remove artificial wallet analysis delay**
5. **Fix emoji crash on Windows** — Use ASCII fallback or set UTF-8 encoding

### Should Fix

6. **Persist feature vectors to entity documents** — So wallet analysis behavior fields are populated
7. **Train and load actual ML models** — The infrastructure supports it; just need model.pkl files
8. **Fix CORS to allow any localhost port** — Or use wildcard for dev
9. **Compute the 5 static feature placeholders** — activity_periodicity, counterparty_concentration, etc.

### Nice to Have

10. Wire up actual Bitcoin Core RPC for live block monitoring
11. Set up MongoDB replica set for native change streams instead of polling
12. Add pagination to entities/risk-queue endpoints (currently return ALL records)
