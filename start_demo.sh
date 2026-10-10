#!/usr/bin/env bash
# =============================================================================
# V.E.C.T.O.R — Quick Demo Launcher (Linux/macOS/WSL)
# =============================================================================
set -e

echo "==================================================================="
echo "  V.E.C.T.O.R - Velocity Enhanced Clustering & Outlier Recognition"
echo "  Starting Demo Environment..."
echo "==================================================================="

# 1. Check requirements
command -v node >/dev/null 2>&1 || { echo "[ERROR] node is not installed"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "[ERROR] python3 is not installed"; exit 1; }

# 2. Build Frontend if needed
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

if [ ! -f "Frontend/dist/index.html" ]; then
    echo "[INFO] Building production frontend bundle..."
    cd Frontend
    npm install
    npm run build
    cd ..
fi

# 3. Environment defaults
export PORT=${PORT:-3001}
export MONGO_URI=${MONGO_URI:-mongodb://127.0.0.1:27017}
export MONGO_DB_NAME=${MONGO_DB_NAME:-RedisTransactions}
export BITCOIN_SIMULATION_MODE=${BITCOIN_SIMULATION_MODE:-false}
export DEMO_READ_ONLY=${DEMO_READ_ONLY:-false}

echo "[INFO] Launching unified application server on port ${PORT}..."
echo "[INFO] Dashboard accessible at http://localhost:${PORT}"

cd Frontend
node server/index.js
