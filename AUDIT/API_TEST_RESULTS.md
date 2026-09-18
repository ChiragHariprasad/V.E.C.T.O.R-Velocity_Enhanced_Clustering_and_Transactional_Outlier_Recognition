# V.E.C.T.O.R — API TEST RESULTS

> Test Date: 2026-09-17 | Server: Express @ http://localhost:3001 | DB: MongoDB (RedisTransactions)

## Test Summary

| Metric | Value |
|---|---|
| Total Endpoints Tested | 25 |
| PASS | 25 (100%) |
| FAIL | 0 |
| Error Handling Tests | 6 (all correct) |

---

## GET Endpoints

| # | Endpoint | Status | Records | Latency | Data Quality |
|---|---|---|---|---|---|
| 1 | `GET /api/bitcoin/status` | ✅ 200 | 1 object | ~50ms | 5,004 txs, 981 entities. **⚠️ tps=18.5 and model_latency_ms=12.4 are hardcoded** |
| 2 | `GET /api/bitcoin/blocks` | ✅ 200 | 1 block | ~10ms | Block height 840250, real from bulk ingest |
| 3 | `GET /api/bitcoin/blocks/840250` | ✅ 200 | 1 block | ~8ms | Returns block document |
| 4 | `GET /api/bitcoin/blocks/999999999` | ✅ 404 | Error | ~5ms | Correct 404 for non-existent block |
| 5 | `GET /api/bitcoin/transactions?limit=3` | ✅ 200 | 3 txs | ~10ms | Real transaction documents with risk scores |
| 6 | `GET /api/bitcoin/entities` | ✅ 200 | 981 | ~130ms | Real entities sorted by risk_score desc |
| 7 | `GET /api/bitcoin/entity/ENT_01224F550305` | ✅ 200 | 1 entity + 20 txs | ~20ms | Real entity detail with transactions |
| 8 | `GET /api/bitcoin/entity/NONEXISTENT` | ✅ 404 | Error | ~5ms | Correct 404 |
| 9 | `GET /api/bitcoin/risk-queue` | ✅ 200 | 1,447 | ~70ms | Real risk alerts from pipeline |
| 10 | `GET /api/bitcoin/clusters` | ✅ 200 | 3 | ~2ms | **⚠️ FULLY HARDCODED — not from data** |
| 11 | `GET /api/bitcoin/investigations` | ✅ 200 | 697 | ~6,083ms | Real auto-investigations. **Slow due to large payload** |
| 12 | `GET /api/bitcoin/investigations/INV-FA5BF2A829` | ✅ 200 | Full detail | ~30ms | Complete investigation with 99 leads |
| 13 | `GET /api/bitcoin/investigations/INV-FA5BF2A829/graph` | ✅ 200 | 100 nodes, 99 edges | ~20ms | Real investigation graph |
| 14 | `GET /api/bitcoin/investigations/INV-FA5BF2A829/flow` | ✅ 200 | 99 flow steps | ~15ms | Real flow path with seed analysis |
| 15 | `GET /api/bitcoin/investigations/INV-FA5BF2A829/leads` | ✅ 200 | 99 leads | ~15ms | Ranked leads with composite scores |
| 16 | `GET /api/bitcoin/investigations/NONEXISTENT` | ✅ 404 | Error | ~5ms | Correct 404 |
| 17 | `GET /api/bitcoin/search?q=ENT_` | ✅ 200 | 5 results | ~11ms | Finds real entities |
| 18 | `GET /api/bitcoin/search?q=` | ✅ 200 | 0 results | ~2ms | Empty query returns empty array |
| 19 | `GET /api/bitcoin/graph/ENT_01224F550305` | ✅ 200 | 196 nodes, 214 edges | ~50ms | Real transaction graph subgraph |
| 20 | `GET /api/bitcoin/geo-stats` | ✅ 200 | 15 records | ~4ms | Real from IP correlator |
| 21 | `GET /api/bitcoin/ip-correlations` | ✅ 200 | 981 entities | ~60ms | Real IP profiles with anonymity scores |
| 22 | `GET /api/bitcoin/risk-propagation` | ✅ 200 | Seeds + propagated | ~11ms | Real propagation data |
| 23 | `GET /api/transactions` | ✅ 200 | Legacy txs | ~20ms | Financial monitoring legacy data |
| 24 | `GET /api/transactions/stats` | ✅ 200 | Aggregated stats | ~30ms | Financial monitoring stats |

## POST Endpoints

| # | Endpoint | Body | Status | Result |
|---|---|---|---|---|
| 25 | `POST /api/bitcoin/wallets/:addr/analyze` (valid) | `{}` | ✅ 200 | Returns risk/entity/behavior/txs. **1.5s artificial delay** |
| 26 | `POST /api/bitcoin/wallets/xxxINVALID/analyze` | `{}` | ✅ 404 | Correct: "Address/Entity not found" |
| 27 | `POST /api/bitcoin/investigations` | `{title, risk_score, entities}` | ✅ 201 | Created INV-441352 |
| 28 | `POST /api/bitcoin/ingest` | `{transactions: [...]}` | ✅ 201 | "ingested: 1" + socket emission |

## Data Integrity Verification

| Check | Expected | Actual | Status |
|---|---|---|---|
| Total TXs in status matches DB count | ~5,004 | 5,004 | ✅ |
| Total entities in status matches DB | ~981 | 981 | ✅ |
| Risk queue returns docs with risk_score ≥ 50 | Yes | 1,447 docs, all ≥ 50 | ✅ |
| Entity detail returns matching transactions | entity_id match | ✅ Confirmed | ✅ |
| Investigation graph nodes match discovered_entities count | 100 | 100 | ✅ |
| Investigation leads have valid composite_score range | 0-100 | 12-56.7 | ✅ |
| Geo stats from IP correlator, not fallback | Real data | 15 records from ip_correlations | ✅ |
