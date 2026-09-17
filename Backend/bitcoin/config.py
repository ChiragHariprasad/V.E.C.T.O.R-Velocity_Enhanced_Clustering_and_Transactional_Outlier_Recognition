"""
V.E.C.T.O.R-BITCOIN Configuration Module
Manages environment variables, RPC parameters, model paths, and risk engine thresholds.
"""

import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# ========== Bitcoin Core RPC Configuration ==========
BITCOIN_RPC_HOST = os.getenv("BITCOIN_RPC_HOST", "127.0.0.1")
BITCOIN_RPC_PORT = int(os.getenv("BITCOIN_RPC_PORT", "8332"))
BITCOIN_RPC_USER = os.getenv("BITCOIN_RPC_USER", "")
BITCOIN_RPC_PASSWORD = os.getenv("BITCOIN_RPC_PASSWORD", "")
BITCOIN_NETWORK = os.getenv("BITCOIN_NETWORK", "regtest")  # mainnet, testnet, regtest
RPC_TIMEOUT = int(os.getenv("BITCOIN_RPC_TIMEOUT", "30"))

# Ingestion Settings
ENABLE_MEMPOOL_MONITORING = os.getenv("ENABLE_MEMPOOL_MONITORING", "false").lower() == "true"
START_BLOCK = int(os.getenv("START_BLOCK", "800000")) if os.getenv("START_BLOCK") else None
END_BLOCK = int(os.getenv("END_BLOCK", "800100")) if os.getenv("END_BLOCK") else None
POLL_INTERVAL_SECONDS = float(os.getenv("POLL_INTERVAL_SECONDS", "2.0"))

# ========== Redis Configuration ==========
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_DB = int(os.getenv("REDIS_DB", "0"))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)

STREAM_BITCOIN_BLOCKS = "bitcoin:blocks"
STREAM_BITCOIN_TXS = "bitcoin:transactions"
STREAM_BITCOIN_FEATURES = "bitcoin:features"
STREAM_BITCOIN_RISK = "bitcoin:risk"
STREAM_BITCOIN_ALERTS = "bitcoin:alerts"
STREAM_DEAD_LETTER = "bitcoin:dead_letter"

# ========== MongoDB Configuration ==========
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "RedisTransactions")

COLL_BLOCKS = "bitcoin_blocks"
COLL_TRANSACTIONS = "bitcoin_transactions"
COLL_UTXOS = "bitcoin_utxos"
COLL_ADDRESSES = "bitcoin_addresses"
COLL_ENTITIES = "bitcoin_entities"
COLL_CLUSTERS = "bitcoin_clusters"
COLL_GRAPH_EDGES = "bitcoin_graph_edges"
COLL_FEATURES = "bitcoin_features"
COLL_RISK_EVENTS = "bitcoin_risk_events"
COLL_INVESTIGATIONS = "bitcoin_investigations"

# ========== Graph Analytics Settings ==========
GRAPH_MAX_HOPS = int(os.getenv("GRAPH_MAX_HOPS", "3"))
ENABLE_GRAPH_EMBEDDINGS = os.getenv("ENABLE_GRAPH_EMBEDDINGS", "false").lower() == "true"

# ========== Investigation Engine Settings ==========
INVESTIGATION_THRESHOLD = float(os.getenv("INVESTIGATION_THRESHOLD", "70"))
MAX_INVESTIGATION_DEPTH = int(os.getenv("MAX_INVESTIGATION_DEPTH", "3"))
MAX_INVESTIGATION_ENTITIES = int(os.getenv("MAX_INVESTIGATION_ENTITIES", "100"))
INVESTIGATION_FLOW_SIGNIFICANCE = float(os.getenv("INVESTIGATION_FLOW_SIGNIFICANCE", "0.05"))
INVESTIGATION_RAPID_FORWARD_SEC = int(os.getenv("INVESTIGATION_RAPID_FORWARD_SEC", "600"))
INVESTIGATION_MULTI_SIGNAL_MIN = int(os.getenv("INVESTIGATION_MULTI_SIGNAL_MIN", "3"))

# ========== Multi-Model Risk Engine Weights & Thresholds ==========
RISK_WEIGHT_ML = float(os.getenv("RISK_WEIGHT_ML", "0.30"))
RISK_WEIGHT_GRAPH = float(os.getenv("RISK_WEIGHT_GRAPH", "0.20"))
RISK_WEIGHT_VELOCITY = float(os.getenv("RISK_WEIGHT_VELOCITY", "0.15"))
RISK_WEIGHT_TEMPORAL = float(os.getenv("RISK_WEIGHT_TEMPORAL", "0.10"))
RISK_WEIGHT_UTXO = float(os.getenv("RISK_WEIGHT_UTXO", "0.10"))
RISK_WEIGHT_RULES = float(os.getenv("RISK_WEIGHT_RULES", "0.15"))

RISK_THRESHOLD_LOW = 25
RISK_THRESHOLD_MEDIUM = 50
RISK_THRESHOLD_HIGH = 75

# ========== Model & Schema Versioning ==========
MODEL_VERSION = os.getenv("MODEL_VERSION", "bitcoin_v1")
FEATURE_SCHEMA_VERSION = "bitcoin_features_v1"
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODEL_DIR, exist_ok=True)
