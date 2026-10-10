#!/bin/bash
# =============================================================================
# LEGACY Fedora/WSL bootstrap; this installer is environment-specific and was
# not exercised in the current verification environment. Prefer README.md and
# Docker Compose for the documented demo setup.
# Installs packages system-wide and may require sudo and external repositories.
# =============================================================================
set -e

echo "═══════════════════════════════════════════════════════════════"
echo "  V.E.C.T.O.R — Fedora Setup Script"
echo "═══════════════════════════════════════════════════════════════"

# Get the directory where this script lives
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ─── 1. System packages ─────────────────────────────────────────────
echo ""
echo "▶ [1/6] Installing system packages..."
sudo dnf install -y python3 python3-pip python3-devel gcc gcc-c++ \
    make cmake git curl wget openssl-devel \
    2>/dev/null || echo "  (some packages may already be installed)"

# ─── 2. Node.js ─────────────────────────────────────────────────────
echo ""
echo "▶ [2/6] Checking Node.js..."
if command -v node &>/dev/null; then
    NODE_VER=$(node --version)
    echo "  Node.js ${NODE_VER} already installed."
else
    echo "  Installing Node.js 18 via dnf..."
    sudo dnf module enable -y nodejs:18 2>/dev/null || true
    sudo dnf install -y nodejs npm 2>/dev/null || {
        echo "  Falling back to NodeSource..."
        curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
        sudo dnf install -y nodejs
    }
    echo "  Node.js $(node --version) installed."
fi

# ─── 3. MongoDB ─────────────────────────────────────────────────────
echo ""
echo "▶ [3/6] Checking MongoDB..."
if command -v mongod &>/dev/null || command -v mongosh &>/dev/null; then
    echo "  MongoDB already installed."
else
    echo "  Installing MongoDB Community 7.0..."
    cat <<'MONGOEOF' | sudo tee /etc/yum.repos.d/mongodb-org-7.0.repo
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/9/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://pgp.mongodb.com/server-7.0.asc
MONGOEOF
    sudo dnf install -y mongodb-org 2>/dev/null || {
        echo "  ⚠ MongoDB repo install failed. Trying mongosh only..."
        sudo dnf install -y mongodb-mongosh-shared-openssl3 2>/dev/null || true
    }
fi

# ─── 4. Redis ────────────────────────────────────────────────────────
echo ""
echo "▶ [4/6] Checking Redis..."
if command -v redis-server &>/dev/null; then
    echo "  Redis already installed."
else
    echo "  Installing Redis..."
    sudo dnf install -y redis 2>/dev/null || {
        echo "  Trying from EPEL..."
        sudo dnf install -y epel-release 2>/dev/null || true
        sudo dnf install -y redis
    }
fi

# ─── 5. Python virtual environment & dependencies ───────────────────
echo ""
echo "▶ [5/6] Setting up Python virtual environment..."
VENV_DIR="${HOME}/vector_venv"
if [ ! -d "${VENV_DIR}" ]; then
    python3 -m venv --without-pip "${VENV_DIR}"
    source "${VENV_DIR}/bin/activate"
    curl -sS https://bootstrap.pypa.io/get-pip.py | python3
    echo "  Created venv at ${VENV_DIR}"
else
    echo "  Virtual environment already exists."
fi

source "${VENV_DIR}/bin/activate"
echo "  Upgrading pip..."
pip install --upgrade pip wheel setuptools 2>/dev/null

echo "  Installing Python dependencies..."
pip install -r "${SCRIPT_DIR}/requirements.txt" 2>/dev/null || {
    echo "  Installing packages individually..."
    pip install numpy pandas scikit-learn xgboost joblib umap-learn hdbscan \
        redis pymongo streamlit networkx 2>/dev/null
}

# Install networkx explicitly (needed for graph engine)
pip install networkx 2>/dev/null || true

echo "  Python $(python3 --version) with $(pip list 2>/dev/null | wc -l) packages."

# ─── 6. Node.js dependencies ────────────────────────────────────────
echo ""
echo "▶ [6/6] Installing Node.js dependencies..."
FRONTEND_DIR="${SCRIPT_DIR}/Frontend"
if [ -d "${FRONTEND_DIR}" ]; then
    cd "${FRONTEND_DIR}"
    npm install 2>/dev/null
    echo "  Frontend dependencies installed."

    if [ -d "${FRONTEND_DIR}/server" ]; then
        cd "${FRONTEND_DIR}/server"
        npm install 2>/dev/null || true
        echo "  Server dependencies installed."
    fi
    cd "${SCRIPT_DIR}"
fi

# ─── Done ────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ Setup complete!"
echo ""
echo "  Next step: configure .env, start MongoDB, then run ./start_demo.sh"
echo "═══════════════════════════════════════════════════════════════"
