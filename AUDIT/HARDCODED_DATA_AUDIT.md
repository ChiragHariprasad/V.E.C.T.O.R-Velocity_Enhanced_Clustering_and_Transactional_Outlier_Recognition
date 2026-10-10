# V.E.C.T.O.R — Hardcoded Data & Fallback Audit (Post-Remediation)

> **Target Branch**: `update-branch`  
> **Evaluation Date**: 2026-10-10  
> **Scope**: Status of static placeholders, fallback data, and analytical calculations across Frontend and Backend.  

---

## 1. Feature Engineering Audit (`Backend/bitcoin/bitcoin_features.py`)

In earlier audit versions, 5 behavioral and temporal features were static placeholders. All 5 have been fully remediated with mathematical calculations:

| Feature Name | Previous Status | Current Remediated Implementation | Unit Test Verification |
|---|---|---|---|
| `activity_periodicity` | Static `0.5` | Mathematical periodicity based on arrival interval coefficient of variation ($CV = \sigma / \mu$; $Score = 1 / (1 + CV)$). | `test_01_activity_periodicity_regular_vs_erratic` (PASS) |
| `counterparty_concentration` | Static `0.45` | Herfindahl-Hirschman Index ($HHI = \sum s_i^2$) across all interacting counterparties. | `test_02_counterparty_concentration_hhi` (PASS) |
| `repeated_counterparty_ratio` | Static `0.2` | Proportion of counterparties re-engaged across history ($N_{\text{repeat}} / N_{\text{unique}}$). | `test_03_repeated_counterparty_ratio` (PASS) |
| `counterparty_deviation` | Static `0.15` | Relative deviation of current transaction counterparties from historical entity baseline. | `test_04_counterparty_deviation` (PASS) |
| `temporal_deviation` | Static `0.20` | Relative deviation of current inter-transaction arrival interval from historical mean interval. | `test_05_temporal_deviation` (PASS) |

---

## 2. Frontend UI Remediations (`Frontend/src/`)

All fabricated, static fallback values have been removed from normal production rendering:

| Component | Previous Fallback | Remediated Status |
|---|---|---|
| `BitcoinOverview.tsx` | Hardcoded fallback donut counts `[1, 2, 4, 3]` | Replaced with clean zero-state `[0, 0, 0, 0]` until real alerts load from MongoDB. |
| `BitcoinOverview.tsx` | Hardcoded primary investigation ID `'INV-35C54D881B'` | Dynamically hydrated from database risk queue / investigations collection. |
| `BitcoinOverview.tsx` | Fabricated description `"Targeted Investigation: Cluster outlier detected..."` | Derived dynamically from database investigation trigger reasons. |
| `BitcoinInvestigationView.tsx` | Hardcoded fallback pattern signatures (`Peel Chain...`, `Round Number Split...`) | Fallback removed; displays real detected signatures or empty state. |
| `BitcoinInvestigationView.tsx` | Fabricated fallback metrics (`velocity: 2.0`, `volume: 89.60`, `peers: 13`) | Derived strictly from database entity metrics or zero state. |
| `BitcoinContext.tsx` | Unbounded real-time event additions causing duplicate UI entries | Deduplicated by ID in state (`prev.some(t => t.txid === newTx.txid)`). |

---

## 3. Backend Express Server Remediations (`Frontend/server/index.js`)

| Route / Service | Previous Implementation | Remediated Implementation |
|---|---|---|
| `POST /api/bitcoin/ingest` | Direct MongoDB insertion with default risk fields (no ML) | Spawns `analyze_transaction.py`, runs 66D feature calculation, ML clustering, Isolation Forest inference, and risk evaluation. |
| `POST /api/bitcoin/ingest/raw` | Did not exist | Exposes explicit raw ingestion route marking records as `RAW_UNANALYZED` with `risk_level: UNANALYZED`. |
| `POST /api/bitcoin/investigations` | Created empty record with no graph or flows | Spawns `run_investigation.py` (`InvestigationEngine`), crawls multi-hop subgraphs, computes flow retention, and creates ranked leads. |
| `GET /api/bitcoin/geo-stats` | 10 fabricated hardcoded countries (US, DE, RU, CN, etc.) | Removed fabricated fallback; returns genuine empty array when no IP data is correlated. |
| Node Status Checking | Hardcoded or ambiguous status | Real HTTP RPC probe with 1.5s timeout. DISCONNECTED reported honestly when bitcoind is offline. |

---

## Summary Verdict

Zero fabricated or deceptive analytical metrics remain in production code. All ML predictions, anomaly scores, risk evaluations, and behavioral features are dynamically derived from empirical transaction vectors.
