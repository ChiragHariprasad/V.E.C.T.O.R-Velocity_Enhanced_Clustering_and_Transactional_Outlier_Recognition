# V.E.C.T.O.R

V.E.C.T.O.R is a transaction-monitoring demonstration with two distinct domains:

- **Financial transaction monitoring**: a legacy Python/Redis pipeline and a dashboard backed by MongoDB. Bundled financial records are demo fixtures.
- **Bitcoin transaction intelligence**: a React dashboard and Express API backed by MongoDB, plus Python modules for transaction normalization, entity profiling, graph analysis, feature engineering, anomaly inference, risk scoring, propagation and investigations.

The repository contains both implementation code and proposal/history material. The Bitcoin pages can display seeded synthetic records. They are not evidence of live Bitcoin network monitoring, law-enforcement attribution, or production financial decisioning. The default demo explicitly reports Bitcoin Core as `SIMULATION`; no live node connectivity has been verified for this revision.

## Current implementation and limits

- The Express application serves the REST API, Socket.IO and the built frontend on one port (default `3001`). `npm run dev` serves the Vite development UI separately (default `5173`).
- MongoDB stores both financial and Bitcoin collections. `MONGO_URI` and `MONGO_DB_NAME` are used by the application and both seeders.
- The Bitcoin seed script creates **synthetic demo fixtures** and now tags them with `data_mode: SIMULATION` and a source label. The status endpoint and Overview page identify fixture-only and mixed datasets.
- Python modules contain the bulk ingestion, feature, model, risk and investigation logic. Model files in `Backend/bitcoin/models/` are serialized artifacts; their presence alone does not prove runtime compatibility or valid model quality.
- The tracked automated tests are not all isolated unit tests. Some test scripts expect a running MongoDB, API server, populated database or model runtime. See [current verification](AUDIT/VALIDATION_RESULTS.md) before using their results.
- There is no verified live Bitcoin Core node, clean-install run, cloud deployment, or current end-to-end pass recorded for this checkout. See [GO/NO-GO](AUDIT/GO_NO_GO.md).

## Prerequisites

- Git
- Node.js 20.19+ or 22.12+ and npm (Vite 8 requirement; the Docker image uses the current Node.js 20 image)
- Python 3.11 recommended for the packaged model/scientific dependencies
- MongoDB 7 or a compatible MongoDB URI
- Redis is used by the legacy financial pipeline; the Bitcoin dashboard/API does not require Redis for its Mongo-backed demo mode

## Local installation

From the repository root, create a local environment file and Python environment:

```powershell
Copy-Item .env.example .env
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

On Linux/macOS, use `python3 -m venv .venv` and activate `.venv/bin/activate` instead. Start MongoDB separately, then install and build the frontend:

```powershell
Set-Location Frontend
npm ci
npm run build
npm test
npm run lint
```

Return to the repository root and start the single-port app:

```powershell
Set-Location ..
npm --prefix Frontend run server
```

Open `http://localhost:3001`. The server seeds empty databases with demo fixtures. Those writes are labeled as simulation data. For a two-server development workflow, run `npm --prefix Frontend run dev` in another terminal; the default CORS allowlist includes localhost ports 5173 and 5174.

`start_demo.bat` and `start_demo.sh` are convenience launchers for an already installed environment. They do not install Python dependencies or MongoDB. Both default to Bitcoin simulation and read-only API mode.

## Docker demo

With Docker Compose installed:

```sh
docker compose up --build
```

The Compose configuration starts MongoDB and the application, uses explicit Bitcoin simulation mode, and disables mutating API operations. Visit `http://localhost:3001`. Persistent MongoDB data is stored in the `mongodb_data` volume. `docker compose down -v` removes that volume and its data.

## Free-hosting trial (not verified)

The repository has no validated free-hosting deployment. A low-traffic trial can use a Render Docker web service and a MongoDB Atlas Free cluster, but both providers impose limits and may change their free plans. Render Free web services sleep after 15 minutes without traffic, take about a minute to wake, and have ephemeral local storage; keep all application records in Atlas. Atlas Free clusters have limited storage/throughput and feature support. See the [Render free-service limits](https://render.com/docs/free) and [Atlas Free cluster limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/) before deploying.

1. Create an Atlas Free cluster and a database user restricted to read/write access for `RedisTransactions`. Add the outbound IP ranges shown for the Render service to the Atlas IP access list. Do not use `0.0.0.0/0`; Atlas requires an allowed client IP range, and Render documents the shared ranges for each service's region in its [outbound IP guide](https://render.com/docs/outbound-ip-addresses).
2. Create a Render **Web Service** from this repository and choose the Docker runtime. The Dockerfile builds the React app and starts the Express/Socket.IO server. Render routes HTTP traffic to the port in `PORT`; the app honors that variable. Use the service health path `/api/bitcoin/status`.
3. Set these Render environment variables in the dashboard (do not commit credentials):

   ```text
   NODE_ENV=production
   MONGO_URI=<Atlas SRV connection string>
   MONGO_DB_NAME=RedisTransactions
   BITCOIN_SIMULATION_MODE=true
   DEMO_READ_ONLY=true
   CORS_ORIGIN=https://<your-service>.onrender.com
   ```

   Keep the generated API read-only. Add the final service URL as the exact `CORS_ORIGIN`; do not use a wildcard. URL-encode special characters in the MongoDB username or password.
4. After deployment, check `/api/bitcoin/status`, then run `python test_smoke.py` from the repository root with `VECTOR_SMOKE_BASE_URL` set to the deployed service URL. Confirm the response reports `SIMULATION` and seeded data is labeled synthetic.

This is a deployment outline, not a verified free-host recipe. This checkout was not deployed to Render or Atlas; startup, outbound-IP allowlisting, free-tier capacity, cold starts and recovery still need to be verified. Free service quotas can change, and this stack may exceed free build/runtime limits. Do not put real financial records or credentials in a public demo.

## API and real-time events

All Bitcoin endpoints are under `/api/bitcoin`. The implementation includes status, blocks, search, transactions, entities/addresses, graph, risk queue, clusters, investigations, wallet analysis, Geo/IP correlations, risk propagation and ingestion routes. The financial domain exposes `/api/transactions` and `/api/transactions/stats`.

Useful read endpoints include:

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/bitcoin/status` | Node, model, dataset and stored-count status |
| GET | `/api/bitcoin/transactions?limit=50` | Recent Bitcoin records |
| GET | `/api/bitcoin/entities` | Entity records |
| GET | `/api/bitcoin/risk-queue?limit=100&skip=0` | Bounded risk-event page |
| GET | `/api/bitcoin/investigations?limit=50&skip=0` | Investigation summaries without graph payloads |
| GET | `/api/bitcoin/investigations/:id` | One investigation detail record |

Socket.IO events currently emitted include `newTransaction`, `bitcoin:newTransaction`, `bitcoin:newRiskEvent`, `bitcoin:newAlert`, and `bitcoin:investigationCreated`. The standalone-MongoDB fallback polls for newly inserted documents; it is not a MongoDB change stream.

Mutating Bitcoin routes are read-only unless `DEMO_READ_ONLY=false` is explicitly set. In production, enabling writes also requires `API_WRITE_TOKEN`; clients must send it as `Authorization: Bearer <token>`. Write requests are rate-limited in-process, JSON bodies are limited to 2 MB by default, analyzed batches to 50 transactions and raw batches to 200. The process-local limiter is a demo safeguard, not a substitute for a production gateway or distributed rate limiter.

## Tests and checks

From `Frontend/`:

```sh
npm test
npm run lint
npm run build
node --check server/index.js
```

The Python suite requires the dependencies in `requirements.txt`; several system and API scripts also require external services and populated fixtures. Do not run destructive seed commands against data you need: `node Frontend/server/seed.js` and `node Frontend/server/seed_bitcoin.js` force reseeding. `python -m bitcoin.bulk_ingest` preserves existing records by default; `--drop-existing` explicitly clears Bitcoin collections.

With MongoDB and the app running, use `python test_smoke.py` from the repository root to check SPA/API health, transaction and investigation reads, entity search, and the default read-only write guard. The smoke check intentionally sends an empty batch and never writes transaction data.

For a real local analysis/persistence/socket check, start the server against a disposable local MongoDB database with `DEMO_READ_ONLY=false` (and a token if production mode is used), then opt into the one-transaction test:

```powershell
$env:VECTOR_SMOKE_ALLOW_WRITE = 'true'
$env:VECTOR_SMOKE_BASE_URL = 'http://127.0.0.1:3001'
npm --prefix Frontend run test:integration
```

The integration script refuses non-localhost targets, submits one synthetic transaction, and checks the analysis response, GET-by-txid persistence, and `bitcoin:newTransaction` event. Do not run it against a database containing records you need to preserve.

## Configuration

Copy [.env.example](.env.example) to `.env` and set only values needed for the selected local setup. Important settings:

- `MONGO_URI`, `MONGO_DB_NAME`: MongoDB connection and database.
- `PORT`: Express/Socket.IO port.
- `CORS_ORIGIN`: comma-separated exact browser origins; do not use `*` for a public deployment.
- `BITCOIN_SIMULATION_MODE=true`: do not contact Bitcoin Core and report simulation status.
- `BITCOIN_RPC_HOST`, `BITCOIN_RPC_PORT`, `BITCOIN_RPC_USER`, `BITCOIN_RPC_PASSWORD`: read-only status probe settings when simulation mode is false.
- `DEMO_READ_ONLY`, `API_WRITE_TOKEN`, `JSON_BODY_LIMIT`, `WRITE_RATE_LIMIT`, `WRITE_RATE_WINDOW_MS`: mutation controls.
- `PYTHON_PATH`: Python executable used for analytics subprocesses.

The Python Bitcoin configuration also reads variables documented in [Backend/bitcoin/config.py](Backend/bitcoin/config.py), including graph/investigation limits, Redis settings and risk weights. `.env.example` is not a complete list of every Python-only tuning value.

## Further reading

- [System architecture and data flow](System_Architecture.md)
- [Technical write-up](TECHNICAL_WRITEUP.md)
- [Historical financial-domain notes](documentation.txt)
- [Audit and current readiness](AUDIT/GO_NO_GO.md)
- [Validation evidence](AUDIT/VALIDATION_RESULTS.md)
- [Documentation inventory](AUDIT/DOCUMENTATION_INVENTORY.md)
- [Change log](AUDIT/CHANGELOG.md)

## Legal and project notice

See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md) for repository notices. This README does not grant rights beyond those notices. The SIH presentation and PDF are proposal/submission artifacts and contain aspirational material; their appended implementation-status note bounds what is verified in this repository.
