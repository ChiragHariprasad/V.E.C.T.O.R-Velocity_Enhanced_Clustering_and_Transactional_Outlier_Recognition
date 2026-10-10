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
| Bitcoin Python suite | `python -m pytest Backend/bitcoin -q -p no:cacheprovider` | **PASS** — 60 passed, 7 subtests; one upstream XGBoost warning says the serialized fallback model was produced by an older XGBoost version. |
| Ground-truth independence regression | Included in the Bitcoin suite; separately run from `test_remediation_regression.py` | **PASS** — identical transactions with only `is_illicit` changed produce the same ML component score in independent pipelines. |
| Node security/input tests | `npm test` from `Frontend/` | **PASS** — 5 tests, 0 failures. |
| Express/security syntax | `node --check server/index.js`; `node --check server/security.js` | **PASS** |
| Frontend lint | `npm run lint` | **PASS WITH WARNINGS** — 0 errors; three existing `react-refresh/only-export-components` warnings in context modules. |
| Frontend production build | `npm run build` | **PASS** — Vite 8.3.4, 2,174 modules; CSS 70.41 kB; largest JS file 304.36 kB (100.37 kB gzip). Lazy route/tab chunks keep the output below Vite's 500 kB warning threshold. |
| Frontend dependency audit | `npm ci` audit output | **PASS** — 0 vulnerabilities reported after dependency updates. |
| Smoke script syntax | Parse `test_smoke.py` with Python AST | **PASS** |
| Live smoke test | `python test_smoke.py` | **PASS** — local app backed by a temporary MongoDB 8.2.6 in-memory server; six read-only/guard checks passed, including the default write rejection. |
| Docker clean install | `docker info --format '{{.ServerVersion}}'` | **BLOCKED** — Docker daemon unavailable. |
| Local API/database/WebSocket integration | `npm run test:integration` | **PASS** — one random synthetic transaction was analyzed through Express and the Python pipeline, retrieved by txid from MongoDB, and observed on `bitcoin:newTransaction`. The database was in-memory; durable/production MongoDB recovery is not established. |
| Docker clean install | `docker info --format '{{.ServerVersion}}'` | **BLOCKED** — Docker daemon unavailable; Compose startup was not run. |
| Production hosting/live Bitcoin/model quality | Not run | **NOT VERIFIED** — no cloud deployment, Bitcoin Core connection, representative performance benchmark or independently labeled detection-quality evaluation. |
| PPTX visual rendering | PowerPoint/LibreOffice renderer | **BLOCKED** — no renderer available. The appended slide text and seven-slide package structure were inspected; visual layout was not verified. |
| PDF appendix | `pdfinfo`, `pdftotext`, rendered page 7 | **PASS** — seven pages; the updated final page was rendered and visually inspected. Poppler reports missing fonts for two symbols on preceding original pages. |

The XGBoost compatibility warning remains because the producing version of the checked-in pickle is not recorded. The artifact loaded and its tests passed with XGBoost `3.4.1`, but that warning is not suppressed and does not establish production compatibility or model quality.

## Current source changes checked

- Seed scripts use configured MongoDB settings and mark generated records as simulated fixtures.
- Bitcoin node and model status do not infer operational health from artifact file presence or fabricated TPS values.
- Dashboard, investigation, wallet and entity views no longer invent scores, metrics, flow percentages, fixed hop counts, behavioral signatures, or fallback centrality values when the API has no result.
- CORS uses exact origins; mutations default to read-only; enabled production writes require a bearer token; JSON bodies, transaction batches, fields and per-process write rates have bounds.
- The smoke script is safe by default and no longer submits a malformed fake transaction as if it were an end-to-end success.
- npm audit findings were remediated through dependency upgrades and the Tailwind 4/Vite 8 configuration migration; the final clean install reported zero advisories.

The local integration proves an in-memory MongoDB round trip and Socket.IO event for one synthetic transaction. It does not establish durable database recovery, Docker deployment, production hosting, live Bitcoin connectivity, representative performance, or detection quality against ground truth.
