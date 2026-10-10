# Documentation Inventory

**Inventory date:** 10 October 2026  
**Branch:** `update-branch`  
**Discovery basis:** tracked repository files from `git ls-files` before edits, plus all documentation-bearing files added or changed in this pass, source surfaces, deployment/configuration files, audit reports and binary project deliverables. Generated build output and TypeScript build-info caches, serialized model/data payloads, images and raw CSV/XML datasets are excluded unless another listed file describes them.

**Status key:** `UPDATED` means edited in this pass; `VERIFIED_CURRENT` means reviewed against current implementation or setup evidence; `HISTORICAL` means retained with a clear history/proposal label; `BLOCKED` means a specific verification could not be completed and is explained in the action column.

Older audit outputs remain for change history; their pass counts are not current evidence. Current readiness and run evidence are `AUDIT/GO_NO_GO.md` and `AUDIT/VALIDATION_RESULTS.md`.

| File | Status | Action taken / final verification |
|---|---|---|
| `AUDIT/CHANGELOG.md` | UPDATED | Concise current remediation and documentation change record. |
| `AUDIT/DOCUMENTATION_INVENTORY.md` | UPDATED | Lists discovered documentation-bearing files and their review status. |
| `AUDIT/GO_NO_GO.md` | UPDATED | Current acceptance gate, evidence, bounded scope and remaining steps. |
| `.env.example` | UPDATED | Documented exact CORS, simulation, write-access, payload and rate defaults. |
| `AUDIT/API_TEST_RESULTS.md` | HISTORICAL | Retained as a prior audit/recommendation with a supersession notice. |
| `AUDIT/BASELINE.md` | HISTORICAL | Retained as a prior audit/recommendation with a supersession notice. |
| `AUDIT/E2E_TEST_RESULTS.md` | HISTORICAL | Retained as a prior audit/recommendation with a supersession notice. |
| `AUDIT/GOLDEN_PATH_TEST.md` | HISTORICAL | Retained as a prior audit/recommendation with a supersession notice. |
| `AUDIT/HARDCODED_DATA_AUDIT.md` | HISTORICAL | Retained as a prior audit/recommendation with a supersession notice. |
| `AUDIT/SYSTEM_AUDIT.md` | HISTORICAL | Retained as a prior audit/recommendation with a supersession notice. |
| `AUDIT/UI_AUDIT.md` | HISTORICAL | Retained as a prior audit/recommendation with a supersession notice. |
| `AUDIT/UX_RECOMMENDATIONS.md` | HISTORICAL | Retained as a prior audit/recommendation with a supersession notice. |
| `AUDIT/VALIDATION_RESULTS.md` | UPDATED | Current commands/results; local in-memory HTTP/integration checks and external blockers are distinguished. |
| `Backend/bitcoin/__init__.py` | VERIFIED_CURRENT | Reviewed as active Bitcoin implementation/documentation surface; runtime claims remain bounded by current validation. |
| `Backend/bitcoin/address_extractor.py` | VERIFIED_CURRENT | Reviewed as active Bitcoin implementation/documentation surface; runtime claims remain bounded by current validation. |
| `Backend/bitcoin/analyze_transaction.py` | VERIFIED_CURRENT | Reviewed as active Bitcoin implementation/documentation surface; runtime claims remain bounded by current validation. |
| `Backend/bitcoin/backfill_entity_metrics.py` | VERIFIED_CURRENT | Reviewed as active Bitcoin implementation/documentation surface; runtime claims remain bounded by current validation. |
| `Backend/bitcoin/bitcoin_features.py` | VERIFIED_CURRENT | Reviewed as active Bitcoin implementation/documentation surface; runtime claims remain bounded by current validation. |
| `Backend/bitcoin/bitcoin_rules.py` | VERIFIED_CURRENT | Reviewed as active Bitcoin implementation/documentation surface; runtime claims remain bounded by current validation. |
| `Backend/bitcoin/block_processor.py` | VERIFIED_CURRENT | Reviewed as active Bitcoin implementation/documentation surface; runtime claims remain bounded by current validation. |
| `Backend/bitcoin/bulk_ingest.py` | VERIFIED_CURRENT | Reviewed as active Bitcoin implementation/documentation surface; runtime claims remain bounded by current validation. |
| `Backend/bitcoin/config.py` | VERIFIED_CURRENT | Reviewed as active Bitcoin implementation/documentation surface; runtime claims remain bounded by current validation. |
| `Backend/bitcoin/entity_profiler.py` | VERIFIED_CURRENT | Reviewed as active Bitcoin implementation/documentation surface; runtime claims remain bounded by current validation. |
| `Backend/bitcoin/generate_dataset.py` | VERIFIED_CURRENT | Reviewed as active Bitcoin implementation/documentation surface; runtime claims remain bounded by current validation. |
| `Backend/bitcoin/investigation_engine.py` | VERIFIED_CURRENT | Reviewed as active Bitcoin implementation/documentation surface; runtime claims remain bounded by current validation. |
| `Backend/bitcoin/ip_correlator.py` | VERIFIED_CURRENT | Reviewed as active Bitcoin implementation/documentation surface; runtime claims remain bounded by current validation. |
| `Backend/bitcoin/ml_inference.py` | VERIFIED_CURRENT | Reviewed as active Bitcoin implementation/documentation surface; runtime claims remain bounded by current validation. |
| `Backend/bitcoin/models/bitcoin_cluster_metadata.json` | VERIFIED_CURRENT | Model/cluster metadata file identified as an inference/reporting input; runtime model loading remains unverified. |
| `Backend/bitcoin/models/model_metadata.json` | VERIFIED_CURRENT | Model metadata file identified as an inference/reporting input; runtime model loading remains unverified. |
| `Backend/bitcoin/risk_engine.py` | VERIFIED_CURRENT | Reviewed as active Bitcoin implementation/documentation surface; runtime claims remain bounded by current validation. |
| `Backend/bitcoin/risk_propagation.py` | VERIFIED_CURRENT | Reviewed as active Bitcoin implementation/documentation surface; runtime claims remain bounded by current validation. |
| `Backend/bitcoin/rpc_client.py` | VERIFIED_CURRENT | Reviewed as active Bitcoin implementation/documentation surface; runtime claims remain bounded by current validation. |
| `Backend/bitcoin/run_investigation.py` | VERIFIED_CURRENT | Reviewed as active Bitcoin implementation/documentation surface; runtime claims remain bounded by current validation. |
| `Backend/bitcoin/schemas.py` | VERIFIED_CURRENT | Reviewed as active Bitcoin implementation/documentation surface; runtime claims remain bounded by current validation. |
| `Backend/bitcoin/smoke_test.py` | VERIFIED_CURRENT | Reviewed as active Bitcoin implementation/documentation surface; runtime claims remain bounded by current validation. |
| `Backend/bitcoin/test_analytical_core.py` | VERIFIED_CURRENT | Executed in a clean requirements environment; part of the passing 60-test suite. |
| `Backend/bitcoin/test_bitcoin_pipeline.py` | VERIFIED_CURRENT | Executed in a clean requirements environment; part of the passing 60-test suite. |
| `Backend/bitcoin/test_full_system_validation.py` | VERIFIED_CURRENT | Executed in a clean requirements environment; part of the passing 60-test suite. |
| `Backend/bitcoin/test_infrastructure_status.py` | VERIFIED_CURRENT | Executed in a clean requirements environment; part of the passing 60-test suite. |
| `Backend/bitcoin/test_investigation_engine.py` | VERIFIED_CURRENT | Executed in a clean requirements environment; part of the passing 60-test suite. |
| `Backend/bitcoin/test_remediation_regression.py` | UPDATED | Strengthened label-independence regression to compare identical transactions in independent pipelines; suite passes. |
| `Backend/bitcoin/test_wallet_search.py` | VERIFIED_CURRENT | Executed in a clean requirements environment; part of the passing 60-test suite. |
| `Backend/bitcoin/train.py` | VERIFIED_CURRENT | Reviewed as active Bitcoin implementation/documentation surface; runtime claims remain bounded by current validation. |
| `Backend/bitcoin/transaction_graph.py` | VERIFIED_CURRENT | Reviewed as active Bitcoin implementation/documentation surface; runtime claims remain bounded by current validation. |
| `Backend/bitcoin/transaction_parser.py` | VERIFIED_CURRENT | Reviewed as active Bitcoin implementation/documentation surface; runtime claims remain bounded by current validation. |
| `Backend/bitcoin/utxo_manager.py` | VERIFIED_CURRENT | Reviewed as active Bitcoin implementation/documentation surface; runtime claims remain bounded by current validation. |
| `Backend/common_constants.py` | HISTORICAL | Legacy financial Python source retained; current runtime is not verified. |
| `Backend/consumer.py` | HISTORICAL | Legacy financial Python source retained; current runtime is not verified. |
| `Backend/customproducer.py` | HISTORICAL | Legacy financial Python source retained; current runtime is not verified. |
| `Backend/producer.py` | HISTORICAL | Legacy financial Python source retained; current runtime is not verified. |
| `Backend/trigger.py` | HISTORICAL | Legacy financial Python source retained; current runtime is not verified. |
| `Backend_tryout/consumer.py` | HISTORICAL | Experimental source retained; not described as the active Bitcoin runtime. |
| `Backend_tryout/custom.py` | HISTORICAL | Experimental source retained; not described as the active Bitcoin runtime. |
| `Backend_tryout/customproducer.py` | HISTORICAL | Experimental source retained; not described as the active Bitcoin runtime. |
| `Backend_tryout/feature_engineering.py` | HISTORICAL | Experimental source retained; not described as the active Bitcoin runtime. |
| `Backend_tryout/modelconverter.py` | HISTORICAL | Experimental source retained; not described as the active Bitcoin runtime. |
| `Backend_tryout/onnx_inferencer.py` | HISTORICAL | Experimental source retained; not described as the active Bitcoin runtime. |
| `Backend_tryout/producer.py` | HISTORICAL | Experimental source retained; not described as the active Bitcoin runtime. |
| `Backend_tryout/trigger.py` | HISTORICAL | Experimental source retained; not described as the active Bitcoin runtime. |
| `Dockerfile` | UPDATED | Switched to lockfile-backed npm ci. |
| `Frontend/eslint.config.js` | VERIFIED_CURRENT | Checked as current frontend/API/config surface; build and lint outcomes are in validation report. |
| `Frontend/package-lock.json` | UPDATED | Regenerated through dependency security fixes; clean `npm ci` passed with zero vulnerabilities. |
| `Frontend/package.json` | UPDATED | Added Node engine range, security regression test command, and .env-aware server command; upgraded build toolchain. |
| `Frontend/postcss.config.js` | UPDATED | Migrated to Tailwind 4's `@tailwindcss/postcss` plugin; production build passed. |
| `Frontend/server/index.js` | UPDATED | Exact CORS, write controls, fixture-aware telemetry, removed hard-coded values and bounded inputs. |
| `Frontend/server/integration-smoke.js` | UPDATED | Guarded localhost-only synthetic API-to-Python-to-MongoDB-to-Socket.IO smoke; executed successfully against temporary in-memory MongoDB. |
| `Frontend/server/security.js` | UPDATED | Added reusable CORS, write-gate and payload validators. |
| `Frontend/server/security.test.js` | UPDATED | Five Node regression tests added; all passed. |
| `Frontend/server/seed.js` | UPDATED | Seeder uses configured MongoDB settings and labels financial seed fixtures as simulation. |
| `Frontend/server/seed_bitcoin.js` | UPDATED | Seeder uses configured MongoDB settings and labels Bitcoin fixtures as simulation. |
| `Frontend/src/App.tsx` | UPDATED | Added lazy route imports so the financial and Bitcoin applications load as separate chunks. |
| `Frontend/src/components/AnalysisProgress.tsx` | VERIFIED_CURRENT | Checked as current frontend/API/config surface; build and lint outcomes are in validation report. |
| `Frontend/src/components/ChartCard.tsx` | VERIFIED_CURRENT | Checked as current frontend/API/config surface; build and lint outcomes are in validation report. |
| `Frontend/src/components/Header.tsx` | VERIFIED_CURRENT | Checked as current frontend/API/config surface; build and lint outcomes are in validation report. |
| `Frontend/src/components/LoadingScreen.tsx` | VERIFIED_CURRENT | Checked as current frontend/API/config surface; build and lint outcomes are in validation report. |
| `Frontend/src/components/SearchFilters.tsx` | VERIFIED_CURRENT | Checked as current frontend/API/config surface; build and lint outcomes are in validation report. |
| `Frontend/src/components/SearchOverlay.tsx` | VERIFIED_CURRENT | Checked as current frontend/API/config surface; build and lint outcomes are in validation report. |
| `Frontend/src/components/StatCard.tsx` | VERIFIED_CURRENT | Checked as current frontend/API/config surface; build and lint outcomes are in validation report. |
| `Frontend/src/components/ThemeToggle.tsx` | VERIFIED_CURRENT | Checked as current frontend/API/config surface; build and lint outcomes are in validation report. |
| `Frontend/src/components/TransactionTable.tsx` | VERIFIED_CURRENT | Checked as current frontend/API/config surface; build and lint outcomes are in validation report. |
| `Frontend/src/context/BitcoinContext.tsx` | VERIFIED_CURRENT | Checked as current frontend/API/config surface; build and lint outcomes are in validation report. |
| `Frontend/src/context/ThemeContext.tsx` | VERIFIED_CURRENT | Checked as current frontend/API/config surface; build and lint outcomes are in validation report. |
| `Frontend/src/context/TransactionContext.tsx` | VERIFIED_CURRENT | Checked as current frontend/API/config surface; build and lint outcomes are in validation report. |
| `Frontend/src/main.tsx` | VERIFIED_CURRENT | Checked as current frontend/API/config surface; build and lint outcomes are in validation report. |
| `Frontend/src/index.css` | UPDATED | Migrated Tailwind directives and loaded the retained JS theme config with `@config`; production build passed. |
| `Frontend/src/pages/Dashboard.tsx` | VERIFIED_CURRENT | Checked as current frontend/API/config surface; build and lint outcomes are in validation report. |
| `Frontend/src/pages/bitcoin/BitcoinAddressEntityExplorer.tsx` | UPDATED | Removed derived velocity and fallback centrality values; build outcome is in validation report. |
| `Frontend/src/pages/bitcoin/BitcoinAnomalyTimeline.tsx` | VERIFIED_CURRENT | Checked as current frontend/API/config surface; build and lint outcomes are in validation report. |
| `Frontend/src/pages/bitcoin/BitcoinBehavioralClusters.tsx` | VERIFIED_CURRENT | Checked as current frontend/API/config surface; build and lint outcomes are in validation report. |
| `Frontend/src/pages/bitcoin/BitcoinDashboard.tsx` | UPDATED | Lazily loads selected Bitcoin tabs; production build now emits smaller tab chunks. |
| `Frontend/src/pages/bitcoin/BitcoinDataSources.tsx` | VERIFIED_CURRENT | Checked as current frontend/API/config surface; build and lint outcomes are in validation report. |
| `Frontend/src/pages/bitcoin/BitcoinInvestigationView.tsx` | UPDATED | Removed invented forwarding, retention, risk and seed-metric fallbacks; build outcome is in validation report. |
| `Frontend/src/pages/bitcoin/BitcoinInvestigations.tsx` | VERIFIED_CURRENT | Checked as current frontend/API/config surface; build and lint outcomes are in validation report. |
| `Frontend/src/pages/bitcoin/BitcoinLiveTransactions.tsx` | VERIFIED_CURRENT | Checked as current frontend/API/config surface; build and lint outcomes are in validation report. |
| `Frontend/src/pages/bitcoin/BitcoinModelPerformance.tsx` | UPDATED | Removed unsupported model-status claims; build outcome is in validation report. |
| `Frontend/src/pages/bitcoin/BitcoinOverview.tsx` | UPDATED | Removed hard-coded entity/risk/chart/anomaly/flow/signature values and displays simulation marker. |
| `Frontend/src/pages/bitcoin/BitcoinRiskQueue.tsx` | VERIFIED_CURRENT | Checked as current frontend/API/config surface; build and lint outcomes are in validation report. |
| `Frontend/src/pages/bitcoin/BitcoinSystemSettings.tsx` | VERIFIED_CURRENT | Checked as current frontend/API/config surface; build and lint outcomes are in validation report. |
| `Frontend/src/pages/bitcoin/BitcoinTransactionExplorer.tsx` | VERIFIED_CURRENT | Checked as current frontend/API/config surface; build and lint outcomes are in validation report. |
| `Frontend/src/pages/bitcoin/BitcoinTransactionGraph.tsx` | UPDATED | Removed fake entity fallback; hydrates from available entities. |
| `Frontend/src/pages/bitcoin/WalletIntelligence.tsx` | UPDATED | Represents unavailable wallet metrics as unavailable; build outcome is in validation report. |
| `Frontend/src/config/api.ts` | NEW | Centralized API origin and Socket.IO URL configuration module; dev fallback, trailing-slash stripping, missing config error. |
| `Frontend/src/socket.ts` | UPDATED | Migrated to centralized API config module. |
| `Frontend/src/context/BitcoinContext.tsx` | UPDATED | Migrated API origin resolution to centralized API config module. |
| `Frontend/src/context/TransactionContext.tsx` | UPDATED | Migrated API origin resolution to centralized API config module. |
| `Frontend/src/types/bitcoin.ts` | UPDATED | Added dataset mode and simulated fixture count fields. |
| `Frontend/src/types/index.ts` | VERIFIED_CURRENT | Checked as current frontend/API/config surface; build and lint outcomes are in validation report. |
| `Frontend/src/vite-env.d.ts` | VERIFIED_CURRENT | Checked as current frontend/API/config surface; build and lint outcomes are in validation report. |
| `Frontend/tailwind.config.js` | VERIFIED_CURRENT | Checked as current frontend/API/config surface; build and lint outcomes are in validation report. |
| `Frontend/tsconfig.app.json` | VERIFIED_CURRENT | Checked as current frontend/API/config surface; build and lint outcomes are in validation report. |
| `Frontend/tsconfig.json` | VERIFIED_CURRENT | Checked as current frontend/API/config surface; build and lint outcomes are in validation report. |
| `Frontend/tsconfig.node.json` | VERIFIED_CURRENT | Checked as current frontend/API/config surface; build and lint outcomes are in validation report. |
| `Frontend/vite.config.ts` | UPDATED | Removed hardcoded allowedHosts domain; dev server on port 5173. |
| `Frontend/vercel.json` | NEW | Vercel SPA rewrite configuration routing deep links to /index.html. |
| `Frontend/.env.example` | NEW | Template for browser-visible Vite build-time environment variables. |
| `Frontend/server/index.js` | UPDATED | Added /healthz endpoint, 0.0.0.0 bind, explicit SEED_DEMO_DATA opt-in, db handle injection to seeders, graceful shutdown. |
| `Frontend/server/seed.js` | UPDATED | Accepts db handle; eliminated hardcoded localhost URI; idempotent checks. |
| `Frontend/server/seed_bitcoin.js` | UPDATED | Accepts db handle; eliminated hardcoded localhost URI; idempotent checks. |
| `Frontend/server/deployment.test.js` | NEW | Automated deployment regression test suite (8 tests); total 13 Node tests pass. |
| `Dockerfile` | UPDATED | Python 3.12 + Node 22 runtime; /healthz health check; binds to $PORT; minimal context without secrets. |
| `.dockerignore` | NEW | Build context exclusion rules (excludes secrets, dev configs, and build caches). |
| `render.yaml` | NEW | Render Blueprint specification with dashboard-supplied secret configuration. |
| `.gitignore` | UPDATED | Ignores .env*, build artifacts, test caches, and OS files while preserving example envs. |
| `LICENSE` | VERIFIED_CURRENT | License retained unchanged. |
| `NOTICE.md` | VERIFIED_CURRENT | Legal notice retained unchanged. |
| `README.md` | UPDATED | Added Vercel + Render + MongoDB Atlas demo deployment guide, topology, and boundaries. |
| `SIH2025-SIH26146_Team-Prometeuss.pdf` | UPDATED | Updated the appended status page with current Python/frontend/local integration evidence; rendered and visually inspected. |
| `SIH2025-SIH26146_Team-Prometeuss.pptx` | UPDATED | Updated appended status slide with current Python/frontend/local integration evidence; text/package inspected, visual rendering unavailable. |
| `System_Architecture.md` | UPDATED | Added Vercel + Render + Atlas deployment topology and operational boundaries diagram. |
| `TECHNICAL_WRITEUP.md` | HISTORICAL | Added design/history status notice; proposal claims retained as non-runtime evidence. |
| `docker-compose.yml` | UPDATED | Added SEED_DEMO_DATA=true, simulation mode, and read-only flags. |
| `documentation.txt` | HISTORICAL | Renamed as legacy TransactionIQ notes with explicit stale-claim notice. |
| `requirements.txt` | UPDATED | Added pytest and pinned scikit-learn 1.7.1 to the checked-in serialized artifact version. |
| `run.sh` | UPDATED | Replaced process-killing launcher with a safe compatibility wrapper. |
| `setup_fedora.sh` | BLOCKED | Legacy Fedora bootstrap is environment-specific and unexecuted; README recommends bounded Docker/local setup. |
| `start_demo.bat` | UPDATED | Uses npm ci and defaults to simulation/read-only mode. |
| `start_demo.sh` | UPDATED | Uses npm ci and defaults to simulation/read-only mode. |
| `test_smoke.py` | UPDATED | Reworked as a safe read-only smoke check; six checks passed against the local app and temporary in-memory MongoDB. |
