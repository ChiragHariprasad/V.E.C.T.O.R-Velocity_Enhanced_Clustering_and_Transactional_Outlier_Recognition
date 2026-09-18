# V.E.C.T.O.R — UX RECOMMENDATIONS

---

## Priority 1: Must Fix Before Demo

### UX-1: Remove Fake Health Metrics
The Overview page's "Pipeline Telemetry" panel displays:
- **18.5 tx/sec** — This is hardcoded, not measured
- **12.4 ms** ML Inference Latency — This is hardcoded, not measured
- **Connection: Healthy** — Always shows healthy even without Bitcoin Core

**Recommendation**: Either compute these dynamically or clearly label them as "Target" or "Benchmark" values. Never display false system health.

### UX-2: Fix Behavioral Clusters Page
The entire Clusters page shows 3 fabricated clusters. This is the most misleading page in the application.

**Recommendation**: Compute real clusters from entity feature vectors using the installed HDBSCAN library, or display an honest "Clustering not yet computed — run HDBSCAN pipeline" empty state.

### UX-3: Fix Search for Real Entity IDs
Searching for bulk-ingested entities (format: `ENT_XXXXXXXXXXXX`) doesn't trigger entity-specific search because the code checks for `ENT_BTC_*` prefix.

**Recommendation**: Change the prefix check to `ENT_` to match all entity ID formats.

### UX-4: Remove Artificial Wallet Analysis Delay
The 1.5-second `setTimeout` on wallet analysis creates unnecessary friction.

**Recommendation**: Remove the delay. If a loading animation is desired, implement it on the frontend side.

### UX-5: Fix Windows Console Crash
The bulk ingestion pipeline crashes at the final summary print due to emoji characters on Windows cp1252 encoding.

**Recommendation**: Set `PYTHONIOENCODING=utf-8` or replace emoji with ASCII: `"🚨"` → `"[ALERT]"`.

---

## Priority 2: Should Fix

### UX-6: Populate Wallet Intelligence Behavior Metrics
The Wallet Intelligence page shows 0 for velocity, volume, and average transaction value because these computed features aren't persisted to entity documents.

**Recommendation**: Add `velocity_1h`, `velocity_24h`, `total_volume_btc`, `avg_tx_value` fields to the entity persistence logic in `bulk_ingest.py`'s `_persist_results()`.

### UX-7: Add Pagination to Large Lists
The `/api/bitcoin/entities` (981 records) and `/api/bitcoin/investigations` (697 records, 6+ second response) endpoints return ALL records in a single response.

**Recommendation**: Add `?page=1&limit=50` query parameters and implement cursor-based pagination.

### UX-8: Fix CORS for Dynamic Ports
Socket.IO CORS is hardcoded to `localhost:5173` but Vite often picks 5174.

**Recommendation**: Use `origin: /localhost/` regex or `origin: '*'` in development.

### UX-9: Compute Static Feature Placeholders
5 features in the feature engine return hardcoded values. These should be computed from entity history.

**Recommendation**: Implement actual computation for `activity_periodicity`, `counterparty_concentration`, `repeated_counterparty_ratio`, `counterparty_deviation`, `temporal_deviation`.

---

## Priority 3: Nice to Have

### UX-10: Train Actual ML Models
The entire ML infrastructure (Isolation Forest, XGBoost) is available but no trained model is loaded. The current `ml_score = 0.15` baseline significantly underweights the ML component.

**Recommendation**: After bulk ingest, train an Isolation Forest on the 50+ feature vectors and serialize with joblib. Load model on subsequent runs.

### UX-11: Add Export/Download Functionality
Investigation reports, entity profiles, and alert queues should be exportable.

**Recommendation**: Add CSV/JSON/PDF export buttons to investigation detail, entity detail, and risk queue pages.

### UX-12: Improve Investigation List Performance
Loading 697 full investigation documents takes 6+ seconds.

**Recommendation**: Only fetch summary fields in the list view. Load full detail on click.
