# Documentation and Remediation Change Log

## 10 October 2026 — current checkout

- Removed hard-coded Bitcoin TPS telemetry and model-cluster status inference from artifact-file presence.
- Marked seeded financial and Bitcoin fixtures as simulated and made seeders honor configured MongoDB URI/database.
- Removed synthetic dashboard entity, risk, volume and anomaly fallbacks; added explicit simulation/mixed-source labels.
- Removed invented investigation forwarding/retention values and risk/seed metric defaults; unavailable values now display as unavailable.
- Removed hard-coded overview behavior signatures and derived velocity/centrality placeholders; flow summaries now show unavailable values when the engine did not report them.
- Restricted default CORS to exact local development origins; made API writes read-only by default, required a production bearer token for enabled writes, and added in-process rate, payload, batch and field limits.
- Added five Node regression tests for the CORS policy, write gate, rate limit, payload validation and investigation validation.
- Strengthened the Python label-independence regression to compare equal ML component scores for otherwise identical transactions processed in independent pipelines.
- Pinned scikit-learn 1.7.1 to the checked-in artifacts and verified a fresh full requirements install; the Python suite passes with one upstream XGBoost serialized-model compatibility warning.
- Upgraded vulnerable frontend dependencies; migrated to Tailwind 4 PostCSS and Vite 8, set the supported Node engine range, and verified a clean npm install/build with zero reported vulnerabilities.
- Reworked `test_smoke.py` into a non-mutating default-mode check so its write-guard probe never submits transaction data.
- Ran the safe HTTP smoke against a local app with temporary in-memory MongoDB; all six checks passed. Added a separately guarded localhost-only integration smoke that verified one synthetic transaction's Express/Python analysis, MongoDB retrieval, and Socket.IO event.
- Split top-level routes and Bitcoin dashboard tabs with lazy imports; production build's largest JS chunk fell from 816.64 kB to 304.36 kB (100.37 kB gzip). Lint currently reports three React Fast Refresh warnings and no errors.
- Set Compose and quick-demo launchers to explicit Bitcoin simulation and read-only operation; made the legacy `run.sh` launcher stop killing services by port.
- Rewrote README and architecture notes; labeled prior audit outputs and proposal/legacy write-ups as historical; added current validation, NO-GO assessment and documentation inventory.
- Appended implementation-status notes to the SIH PowerPoint and PDF. Original proposal material remains in place and is not treated as runtime evidence.

## 10 October 2026 — Vercel + Render + MongoDB Atlas Deployment Preparation

- **Centralized frontend API configuration:** Created `Frontend/src/config/api.ts` providing `API_ORIGIN`, `SOCKET_URL`, `apiUrl`, trailing slash normalization, development localhost fallback, and clear build/startup failure if `VITE_API_BASE_URL` is omitted in production. Migrated `socket.ts`, `BitcoinContext.tsx`, and `TransactionContext.tsx` to shared config.
- **Vercel SPA configuration:** Added `Frontend/vercel.json` with rewrite rules routing non-asset application URLs to `/index.html` for deep linking. Created `Frontend/.env.example`. Removed hardcoded domain from `Frontend/vite.config.ts`.
- **Render backend configuration:** Aligned `Dockerfile` to Python 3.12 + Node 22, configured `/healthz` health check, bound server to `0.0.0.0:$PORT`, and created `.dockerignore` to keep image layers minimal and secret-free. Created `render.yaml` Blueprint with dashboard-supplied secret parameters.
- **MongoDB Atlas consistency & safe seeding:** Refactored `seed.js` and `seed_bitcoin.js` to accept the server's connected database handle, eliminating hardcoded localhost URIs. Added explicit `SEED_DEMO_DATA=true` opt-in flag; normal startups and container restarts perform idempotent checks and never drop collections.
- **Readiness probe & lifecycle:** Added `GET /healthz` returning 503 during startup and 200 `{ status: 'ok', mode: 'simulation' }` once MongoDB connects. Added graceful shutdown handlers for `SIGTERM` and `SIGINT`.
- **Deployment test suite:** Created `Frontend/server/deployment.test.js` adding 8 automated tests covering URL resolution, trailing-slash normalization, missing config errors, CORS comma-separated allowlists, `/healthz` readiness, seeding flag safety, and read-only lockdown. Total Node test suite now has 13 passing tests.
- **Documentation & architecture:** Updated `README.md`, `System_Architecture.md`, `.env.example`, `.gitignore`, `docker-compose.yml`, `AUDIT/GO_NO_GO.md`, `AUDIT/VALIDATION_RESULTS.md`, and `AUDIT/DOCUMENTATION_INVENTORY.md` to document the Vercel + Render + Atlas topology, environment boundaries, and deployment handoff checklist.

## Remaining verification

Durable managed-database recovery, Docker startup, cloud hosting, live-node checks, representative performance and labeled detection quality remain unverified in this environment. The PowerPoint implementation-status slide was updated, but could not be visually rendered because no presentation renderer is installed. See [GO_NO_GO.md](GO_NO_GO.md) and [VALIDATION_RESULTS.md](VALIDATION_RESULTS.md).

