# Current Validation Results

**Run date:** 10 October 2026 (Asia/Kolkata)
**Branch:** `update-branch`
**Initial inspected revision:** `b3e0ee32ee0306a1feec58cc0382ade1a92d0b1d`
**Final revision:** recorded in the final handoff after commit.
**Verdict:** NO-GO for full demo acceptance. See [GO_NO_GO.md](GO_NO_GO.md).

## Environment and clean installs

- Node.js `v22.22.2`; npm `10.9.7`.
- A fresh temporary Python 3.12.14 virtual environment installed the full `requirements.txt`; `pip check` reported no broken requirements.
- `requirements.txt` pins scikit-learn `1.7.1` to match the checked-in scikit-learn pickle metadata.
- A fresh lockfile-based `npm ci` completed with zero reported vulnerabilities. The UI dependencies were migrated to Vite `8.3.4`, `@vitejs/plugin-react` `6.1.2`, and Tailwind CSS `4.3.3`.
- `mongod` and `mongosh` are unavailable. Docker CLI exists, but the Docker Engine/daemon is unavailable.

## Results

| Check | Command | Result |
|---|---|---|
| Python dependency install | Fresh temporary venv: `python -m pip install -r requirements.txt` | **PASS** |
| Python dependency consistency | `python -m pip check` | **PASS** — no broken requirements. |
| Bitcoin Python suite | `python -m pytest Backend/bitcoin -q -p no:cacheprovider` | **PASS** — 60 passed, 4 warnings, 7 subtests; scikit-learn deprecation notice and XGBoost serialization warning. |
| Ground-truth independence regression | Included in the Bitcoin suite; separately run from `test_remediation_regression.py` | **PASS** — identical transactions with only `is_illicit` changed produce the same ML component score in independent pipelines. |
| Node security & deployment tests | `npm test` from `Frontend/` (`security.test.js` + `deployment.test.js`) | **PASS** — 13 tests, 0 failures (CORS allowlist, write guard, token auth, rate limits, payload validation, URL resolution, trailing slash normalization, /healthz readiness, seed flag opt-in). |
| Express/security/seed syntax | `node --check` on all 7 server and test scripts | **PASS** — index.js, security.js, seed.js, seed_bitcoin.js, integration-smoke.js, deployment.test.js, security.test.js. |
| Frontend lint | `npm run lint` | **PASS WITH WARNINGS** — 0 errors; three existing `react-refresh/only-export-components` warnings in context modules. |
| Frontend production build | `npm run build` | **PASS** — Vite 8.3.4, 2,175 modules transformed; CSS 70.41 kB; largest JS chunk 304.69 kB (100.58 kB gzip). All chunks below 500 kB. |
| Frontend dependency audit | `npm ci` audit output | **PASS** — 0 vulnerabilities reported. |
| Smoke script syntax | Parse `test_smoke.py` with Python AST | **PASS** |
| Live local smoke test | `python test_smoke.py` | **PASS** — local app backed by temporary MongoDB in-memory server; six read-only/guard checks passed. |
| Local API/database/WebSocket integration | `npm run test:integration` | **PASS** — synthetic transaction analyzed through Express and Python, retrieved by txid, and observed on Socket.IO. |
| Docker configuration | Dockerfile (Python 3.12 + Node 22), `.dockerignore`, `render.yaml` | **PREPARED** — verified syntax, versions, and build-context rules. Docker Engine CLI was present, daemon was offline locally. |
| Vercel SPA configuration | `Frontend/vercel.json`, `Frontend/.env.example`, `Frontend/src/config/api.ts` | **PREPARED & TESTED** — SPA deep links rewrite to `/index.html`, centralized API URL resolution verified by tests. |
| Live cloud deployment (Render + Vercel + Atlas) | Cloud hosting not run as part of repo prep | **PENDING LIVE CLOUD EXECUTION** — repository is fully prepared with handoff checklist; live cloud deployment must be verified by user. |
| Production hosting/live Bitcoin/model quality | Explicitly out of scope | **OUT OF SCOPE** — demo operates in simulation mode with synthetic fixtures; live Bitcoin node and production financial readiness are not claimed. |
| PPTX visual rendering | PowerPoint/LibreOffice renderer | **BLOCKED** — no renderer available locally. Slide structure verified. |
| PDF appendix | `pdfinfo`, `pdftotext`, rendered page 7 | **PASS** — seven pages; final page verified. |

The XGBoost compatibility warning remains because the producing version of the checked-in pickle is not recorded. The artifact loaded and its tests passed with XGBoost `3.4.1`, but that warning is not suppressed and does not establish production compatibility or model quality.

## Current source changes checked

- Seed scripts use configured MongoDB settings and mark generated records as simulated fixtures.
- Bitcoin node and model status do not infer operational health from artifact file presence or fabricated TPS values.
- Dashboard, investigation, wallet and entity views no longer invent scores, metrics, flow percentages, fixed hop counts, behavioral signatures, or fallback centrality values when the API has no result.
- CORS uses exact origins; mutations default to read-only; enabled production writes require a bearer token; JSON bodies, transaction batches, fields and per-process write rates have bounds.
- The smoke script is safe by default and no longer submits a malformed fake transaction as if it were an end-to-end success.
- npm audit findings were remediated through dependency upgrades and the Tailwind 4/Vite 8 configuration migration; the final clean install reported zero advisories.

The local integration proves an in-memory MongoDB round trip and Socket.IO event for one synthetic transaction. It does not establish durable database recovery, Docker deployment, production hosting, live Bitcoin connectivity, representative performance, or detection quality against ground truth.
