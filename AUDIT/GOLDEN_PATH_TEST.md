# V.E.C.T.O.R — GOLDEN PATH END-TO-END TEST

> **Objective**: Prove the entire data flow from real Bitcoin transaction ingestion → Entity Resolution → ML Inference → Risk → Graph → Investigation → UI/API

---

## Test Execution

**Command Run**:
```
cd Backend
python -m bitcoin.bulk_ingest --input bitcoin/data/bitcoin_dataset.csv --format csv
```

**Dataset**: `bitcoin_dataset.csv` — 5,004 transactions with columns: `timestamp, src_ip, dst_ip, src_port, dst_port, txid, input_addresses, output_addresses, input_amounts, output_amounts, fee, input_count, output_count, geo_country, asn, script_type, pattern, entity_id, is_illicit`

**Result**: Pipeline completed successfully (emoji print crash is non-fatal).

---

## Phase-by-Phase Evidence

### Phase 1: CSV Parsing → Entity Resolution → Graph Construction
- **Input**: 5,004 raw CSV rows
- **Parser**: `_normalize_row()` converts CSV → internal transaction format with inputs/outputs/metadata
- **Entity Profiler**: Common-input heuristic groups addresses → **981 entities created**
- **Graph**: NetworkX MultiDiGraph built with Address → TX → Address edges
- **IP Correlator**: 15 geo records created from bundled GeoIP table

### Phase 2: Centrality Computation
- PageRank (α=0.85, 50 iterations) computed on full graph
- Betweenness centrality (k=100 sample)
- Closeness centrality

### Phase 3: Illicit Entity Seeding
- Transactions with `is_illicit=True` → their entities seeded with risk=1.0
- **21 seed entities marked illicit**

### Phase 4: Risk Propagation
- Label-spreading algorithm with decay factor 0.65
- Max 10 iterations, convergence threshold 0.001
- **18,149 graph nodes processed**
- **56 high-risk nodes** (risk ≥ 0.2)
- Risk paths tracked from seeds to downstream entities

### Phase 5: Feature Engineering + Rules + Risk Scoring
For each of 5,004 transactions:
1. UTXO stats computed (age, spending ratios, fragmentation)
2. Graph features extracted (degree, PageRank, betweenness, closeness, clustering)
3. Structural motifs detected (fan-in/out, flow ratio, rapid forwarding)
4. 50+ behavioral features computed
5. 11 heuristic rules evaluated (peel chain, CoinJoin, Tor, dormant awakening, etc.)
6. 6-component risk score calculated: ML(0.30) + Graph(0.15) + Velocity(0.15) + Temporal(0.15) + UTXO(0.10) + Rules(0.15)
7. Propagated risk contribution added
8. **1,447 alerts generated** (risk_score ≥ 50)

### Phase 6: Automatic Investigation Engine
- `InvestigationTrigger` evaluates each entity for investigation criteria
- **697 investigations created and executed**
- Each investigation runs the 9-phase lifecycle:
  1. Seed Analysis → outflow/inflow/velocity/counterparties
  2. Graph Crawl → BFS discovery of connected entities/transactions
  3. Flow Analysis → forwarding ratios, downstream amounts
  4. Role Assignment → INTERMEDIARY / EXIT_CANDIDATE / DISPERSAL / LAYERING / CONVERGENCE
  5. Pattern Integration → aggregates all detected patterns
  6. Risk Propagation → separate propagation engine per investigation
  7. Graph Building → nodes/edges for visualization
  8. Lead Ranking → P1-P4 composite scoring (direct risk + propagated + flow + patterns + graph importance + role boost)
  9. Evidence Generation → structured evidence from all phases

### Phase 7: MongoDB Persistence
All 6 collections populated:

| Collection | Count |
|---|---|
| bitcoin_transactions | 5,004 |
| bitcoin_entities | 981 |
| bitcoin_risk_events | 1,447 |
| bitcoin_investigations | 697 |
| bitcoin_blocks | 1 |
| bitcoin_ip_correlations | 15 |

### Phase 8: API Verification
All REST endpoints confirmed returning real data from MongoDB (see API_TEST_RESULTS.md).

### Phase 9: UI Rendering
Frontend at http://localhost:5174 confirmed rendering:
- Overview dashboard with real KPIs from DB
- Entity velocity rankings showing actual entity IDs
- Risk severity breakdown donut with real distribution
- Real-time transaction feed via socket.io polling
- Investigation detail pages with graph/flow/leads

---

## Verification: Real Data vs. Seed Data

After bulk ingestion, the `bitcoin_transactions` collection contains **only** bulk-ingested data (the pipeline clears existing collections before persisting). The seed data from `seed_bitcoin.js` is overwritten.

**Evidence**: Entity IDs like `ENT_01224F550305`, `ENT_97B27A4222EA` match the entity profiler's SHA-256 hash pattern, not the seed data's `ENT_BTC_001` pattern.

---

## Conclusion

**The Golden Path works.** Real CSV data flows through all 9 pipeline phases, produces genuine analytical output, persists to MongoDB, and renders in the UI. The primary gap is ML inference (uses heuristic score of 0.15 instead of a trained model).
