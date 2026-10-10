# V.E.C.T.O.R Baseline Audit Report

> **Repository**: `vinith0306/V.E.C.T.O.R-Velocity_Enhanced_Clustering_and_Transactional_Outlier_Recognition`  
> **Checked-out Branch**: `update-branch`  
> **Verified Head Commit**: `1be77e2` ("add frontend components, pages, and context for bitcoin analytics and investigation system")  
> **Audit Date**: 2026-10-10  
> **Environment**: Windows 11, Python 3.13.12, Node.js v22.x, MongoDB 8.2.6 (port 27017)  
> **Principle**: Source code inspection, runtime execution, and reproducible test outputs are the sole ground truth. Prior audit claims were independently verified and refuted where outdated.

---

## 1. Pipeline Architecture & Actual Data Flow

The end-to-end data processing pipeline traces through the following components:

```
[CSV / JSON / XML Dataset]
         │
         ▼
[Transaction Parser & Normalizer] (_normalize_row in bulk_ingest.py)
         │
         ▼
[Entity Resolution & Profiler] (EntityProfiler: common-input heuristic)
         │
         ▼
[Transaction Graph Construction] (BitcoinTransactionGraph: NetworkX directed graph)
         │
         ▼
[Feature Engineering Engine] (BitcoinFeatureEngine: 66-dimensional behavioral vector)
         │
         ▼
[ML Inference Engine] (BitcoinMLInferenceEngine)
  ├─ StandardScaler (bitcoin_scaler.joblib: 66 features)
  ├─ UMAP Dimensionality Reduction (bitcoin_umap.joblib: 66D -> 5D)
  ├─ HDBSCAN Clustering (bitcoin_hdbscan.joblib: behavioral communities)
  ├─ Cluster-Specific Isolation Forest (bitcoin_cluster_[0,1,2]_bundle.pkl)
  └─ XGBoost Classifier Fallback (bitcoin_fallback_xgboost.joblib: cold-start & noise routing)
         │
         ▼
[Behavioral Rules Engine] (BitcoinRulesEngine: peeling chains, coinjoin, velocity spikes)
         │
         ▼
[Multi-Model Risk Engine] (BitcoinRiskEngine: calibrated 0-100 score + explainability)
         │
         ▼
[Risk Propagation Engine] (RiskPropagationEngine: graph label-spreading with decay)
         │
         ▼
[Automatic Investigation Engine] (InvestigationTrigger & InvestigationEngine: crawl, roles, flow, leads)
         │
         ▼
[MongoDB Persistence] (Collections: bitcoin_transactions, bitcoin_entities, bitcoin_risk_events, bitcoin_clusters, bitcoin_investigations, bitcoin_blocks, bitcoin_system_telemetry)
         │
         ▼
[Express.js REST API] (server/index.js on port 3001)
         │
         ▼
[React 18 / TypeScript UI] (Vite SPA on port 5173 / static dist)
         ▲
         │
[Socket.IO Real-time Events] (bitcoin:newTransaction, bitcoin:statusUpdate)
```

---

## 2. Component Verification Baseline

| Subsystem | Verified State | Notes / Ground Truth |
|---|---|---|
| **Feature Schema** | **66 Features** | Verified against `BITCOIN_FEATURE_KEYS` in `schemas.py` and `bitcoin_features.py`. |
| **Global Scaler** | **Shape (1, 66)** | `bitcoin_scaler.joblib` expects 66 features. |
| **UMAP Reducer** | **66D to 5D** | `bitcoin_umap.joblib` accepts 66-dimensional scaled features. |
| **HDBSCAN Clustering** | **Operational** | `bitcoin_hdbscan.joblib` predicts clusters 0, 1, 2, and noise (-1). |
| **Isolation Forests** | **3 Bundles Loaded** | Bundles for clusters 0, 1, and 2 loaded from `models/`. Invert decision function: higher anomaly score = higher risk. |
| **XGBoost Fallback** | **Operational** | `bitcoin_fallback_xgboost.joblib` loaded; used for cold-start (<2 txs) and noise (-1). |
| **Heuristic Fallback** | **Operational** | Dynamic weight re-allocation when `ML_UNAVAILABLE` triggered without manufacturing fake scores. |
| **Python Dependencies** | **Compatible** | Python 3.13.12: `scikit-learn`, `xgboost`, `hdbscan`, `umap-learn`, `joblib`, `pymongo`, `networkx` all importable. |
| **Node.js Frontend** | **Passes Build & Lint** | TypeScript compiles cleanly with 0 errors (`npx tsc --noEmit`); ESLint passes with 0 errors; Vite builds `dist/` cleanly. |
| **MongoDB Connection** | **Active (8.2.6)** | Running locally on port 27017, contains `RedisTransactions` database. |

---

## 3. Confirmed Defects & Severity Assessment

### Defect 1: Ground-Truth Target Leakage in ML Scoring
- **Severity**: **CRITICAL** (Blocking Deployment)
- **Location**: `Backend/bitcoin/bulk_ingest.py`, lines 353–355
- **Evidence**:
  ```python
  propagated_risk = self.risk_propagation.get_risk_score(entity_id)
  if tx.get("is_illicit") and ml_score is not None:
      ml_score = max(ml_score, 0.85)
  ```
- **Reproduction**: Pass any transaction with `is_illicit: True` through `BulkIngestPipeline`. The resulting `ml_score` is artificially set to at least 0.85, regardless of the feature values or actual model inference.
- **Impact**: Falsifies reported ML detection capabilities. Manufactures positive predictions directly from evaluation labels.

### Defect 2: Inconsistent Risk Classification After Propagation
- **Severity**: **HIGH** (Blocking Deployment)
- **Location**: `Backend/bitcoin/bulk_ingest.py`, lines 365–371
- **Evidence**:
  ```python
  final_risk = min(100.0, risk_eval["risk_score"] + propagated_risk * 15.0)
  risk_eval["risk_score"] = round(final_risk, 2)
  tx["risk_score"] = risk_eval["risk_score"]
  tx["risk_level"] = risk_eval["risk_level"]
  ```
- **Reproduction**: Process a transaction whose initial risk score is 45.0 (`MEDIUM`). With propagated risk = 1.0 (+15.0), the score becomes 60.0. However, `tx["risk_level"]` remains `MEDIUM` because `get_risk_level()` was not called on `final_risk`.
- **Impact**: Inconsistency between numeric risk score (60.0 = `HIGH`) and category label (`MEDIUM`), leading to mismatched filtering, counters, and alerts.

### Defect 3: Unconditional Destructive Deletion on Ingestion
- **Severity**: **CRITICAL** (Blocking Deployment)
- **Location**: `Backend/bitcoin/bulk_ingest.py`, lines 480–484, 597
- **Evidence**:
  ```python
  for coll_name in ["bitcoin_transactions", "bitcoin_entities", "bitcoin_risk_events",
                    "bitcoin_blocks", "bitcoin_ip_correlations", "bitcoin_investigations"]:
      self.db[coll_name].delete_many({})
  ...
  self.db["bitcoin_clusters"].delete_many({})
  ```
- **Reproduction**: Ingest a dataset, then ingest a second batch or single transaction via bulk ingest. All previous transactions, entities, and investigations are wiped out.
- **Impact**: Complete data loss on subsequent ingestions. Production data persistence is violated.

### Defect 4: Express Ingestion Route Bypasses Analytics Pipeline
- **Severity**: **CRITICAL** (Blocking Deployment)
- **Location**: `Frontend/server/index.js`, lines 1237–1269
- **Evidence**:
  ```javascript
  app.post('/api/bitcoin/ingest', async (req, res) => {
    ...
    const docs = transactions.map(tx => ({
      ...tx,
      risk_score: tx.risk_score || 0,
      risk_level: tx.risk_level || 'LOW',
      status: 'confirmed',
    }));
    await db.collection('bitcoin_transactions').insertMany(docs);
  ```
- **Reproduction**: Send a POST request to `/api/bitcoin/ingest` with raw transactions. The transactions are inserted into MongoDB with default dummy scores (`risk_score: 0`, `LOW`) without executing graph building, feature engineering, or ML inference.
- **Impact**: Direct DB insertion presented as analytical ingestion. Features and scores are never computed.

### Defect 5: Investigation Creation Route Inserts Empty Stub
- **Severity**: **CRITICAL** (Blocking Deployment)
- **Location**: `Frontend/server/index.js`, lines 1054–1089
- **Evidence**:
  ```javascript
  app.post('/api/bitcoin/investigations', async (req, res) => {
    ...
    const newInv = {
      investigation_id: `INV-${Date.now().toString().slice(-6)}`,
      graph_nodes: [],
      graph_edges: [],
      detected_patterns: [],
      final_leads: [],
      flow_path: [],
      status: 'OPEN'
    };
    await db.collection('bitcoin_investigations').insertOne(newInv);
  ```
- **Reproduction**: Click "New Investigation" or call POST `/api/bitcoin/investigations`. The database receives empty arrays; `investigation_engine.py` is never invoked.
- **Impact**: Investigations are purely cosmetic empty shells; graph crawl and lead ranking are never performed.

### Defect 6: Unbounded Queries on Large Collections Cause Latency Spikes
- **Severity**: **HIGH** (Non-Blocking for small datasets, Blocking for production scale)
- **Location**: `Frontend/server/index.js`, lines 1030–1052 (`/api/bitcoin/investigations`) and lines 415–435 (`/api/bitcoin/risk-queue`)
- **Evidence**:
  ```javascript
  const invs = await db.collection('bitcoin_investigations').find().sort({ created_at: -1 }).toArray();
  ```
- **Reproduction**: Load `/api/bitcoin/investigations` with 700+ investigations. The response payload exceeds 25 MB and takes >13,000 ms to serialize and transmit, freezing the browser.
- **Impact**: Severe UI lag and timeout risks on public deployments.

### Defect 7: Hardcoded Localhost URLs in Browser Client & CORS
- **Severity**: **HIGH** (Blocking Public Deployment)
- **Location**:
  - `Frontend/src/socket.ts`: `io('http://localhost:3001')`
  - `Frontend/src/context/TransactionContext.tsx`: `http://localhost:3001/api/...`
  - `Frontend/src/context/BitcoinContext.tsx`: `http://localhost:3001/api/...`
  - `Frontend/server/index.js`: `cors: { origin: 'http://localhost:5173' }`
- **Reproduction**: Deploy frontend to any remote host or view via public HTTPS tunnel. Client requests fail because the browser attempts to contact the viewer's own `localhost:3001`.
- **Impact**: Public deployment completely non-functional.

### Defect 8: Express Backend Does Not Serve Production Frontend Build
- **Severity**: **MEDIUM** (Blocking Single-Port Deployment)
- **Location**: `Frontend/server/index.js`
- **Evidence**: No `express.static('dist')` middleware or SPA catch-all route `/*` exists.
- **Impact**: Requires running two separate server processes (Node + Vite dev), preventing simple zero-cost single-container or single-process hosting.

### Defect 9: Disconnected Bitcoin Node Handled Gracefully But Lacks Clear Simulation Indicator
- **Severity**: **MEDIUM** (Operational Clarity)
- **Location**: `Frontend/src/components/Header.tsx` and `Frontend/server/index.js`
- **Evidence**: When `BITCOIN_SIMULATION_MODE` is active, the node reports `SIMULATION`, but some UI pages still refer to standard network stats without clear delineation between live RPC and simulation.
- **Impact**: Reviewers cannot distinguish between live on-chain data and simulated feeds.

---

## 4. Remediation Plan Matrix

| Defect | Remediation Target | Phase |
|---|---|---|
| Target Leakage | Remove label inflation; enforce independent ML score; add regression test | Phase 2.A |
| Risk Scoring Consistency | Recompute `risk_level` via canonical `get_risk_level(final_risk)` everywhere | Phase 2.B |
| Unconditional Deletion | Default to safe upsert; require explicit `--drop-existing` flag | Phase 2.E |
| Ingestion Semantics | Connect Express `/api/bitcoin/ingest` to Python analytics; validate schemas | Phase 2.D |
| Real Investigations | Connect Express `/api/bitcoin/investigations` to `InvestigationEngine` | Phase 2.F |
| Unbounded Queries | Add server-side pagination, projection, and limits to investigations & queue | Phase 3 |
| Hardcoded Localhost | Implement `VITE_API_BASE_URL` and relative origin fallback; dynamic CORS | Phase 4 |
| Static SPA Serving | Configure Express to serve Vite production `dist` with SPA route fallback | Phase 4 |
| Simulation Delineation | Display clear `[SIMULATED DATA]` indicator when simulation mode is active | Phase 3 |
