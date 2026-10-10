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

## Remaining verification

Durable managed-database recovery, Docker startup, cloud hosting, live-node checks, representative performance and labeled detection quality remain unverified in this environment. The PowerPoint implementation-status slide was updated, but could not be visually rendered because no presentation renderer is installed. See [GO_NO_GO.md](GO_NO_GO.md) and [VALIDATION_RESULTS.md](VALIDATION_RESULTS.md).
