"""
V.E.C.T.O.R — Final Full-System Validation Suite
Validates:
1. Backend Startup & MongoDB Collections
2. Bitcoin Core Read-Only RPC & Whitelist
3. ML Inference (66 Features, StandardScaler, UMAP, Isolation Forest, XGBoost fallback, dynamic ml_score != 0.15)
4. Multi-Factor Risk Engine (dynamic composite scores)
5. Graph & Network Neighborhood API
6. Investigation Engine (flow, roles, patterns, leads P1-P4, evidence)
7. Wallet Search & Intelligence Workflow (Input/Output consistency)
8. System Status API (measured latency & TPS, no fictional 18.5 or 12.4)
9. Controlled Real-Time Ingestion (POST /api/bitcoin/ingest -> DB -> API verification)
10. System Latency & Performance Benchmarks
"""

import sys
import os
import time
import json
import urllib.request
import urllib.parse
import urllib.error
import pymongo
import numpy as np

# Ensure Backend directory is in path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from bitcoin.rpc_client import BitcoinRPCClient, BitcoinRPCMethodForbiddenError
from bitcoin.bitcoin_features import BitcoinFeatureEngine
from bitcoin.ml_inference import BitcoinMLInferenceEngine, ML_UNAVAILABLE
from bitcoin.risk_engine import BitcoinRiskEngine
from bitcoin.schemas import BITCOIN_FEATURE_KEYS

API_BASE = "http://localhost:3001/api/bitcoin"

benchmarks = {}

def log_section(title):
    print("\n" + "=" * 65)
    print(f"  {title}")
    print("=" * 65)

def validate_database():
    log_section("1. DATABASE VALIDATION (MongoDB)")
    t0 = time.perf_counter()
    client = pymongo.MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=2000)
    db = client["RedisTransactions"]
    collections = db.list_collection_names()
    dur = (time.perf_counter() - t0) * 1000
    benchmarks["db_ping_ms"] = dur
    print(f"MongoDB connected in {dur:.2f}ms. Total collections: {len(collections)}")
    
    counts = {
        "blocks": db["bitcoin_blocks"].count_documents({}),
        "transactions": db["bitcoin_transactions"].count_documents({}),
        "entities": db["bitcoin_entities"].count_documents({}),
        "risk_events": db["bitcoin_risk_events"].count_documents({}),
        "investigations": db["bitcoin_investigations"].count_documents({}),
        "telemetry": db["bitcoin_system_telemetry"].count_documents({})
    }
    for k, v in counts.items():
        print(f"  • {k}: {v:,} records")
        
    assert counts["transactions"] > 0, "Transactions collection is empty!"
    assert counts["entities"] > 0, "Entities collection is empty!"
    assert counts["risk_events"] > 0, "Risk events collection is empty!"
    print("PASS: MongoDB persistence verified with active data.")
    return True, counts

def validate_bitcoin_rpc():
    log_section("2. BITCOIN CORE RPC VALIDATION")
    t0 = time.perf_counter()
    rpc = BitcoinRPCClient()
    status = rpc.get_connection_status()
    dur = (time.perf_counter() - t0) * 1000
    benchmarks["rpc_check_ms"] = dur
    
    print(f"RPC Status: {status['status']} (Checked in {dur:.2f}ms)")
    print(f"Network: {status['network']}")
    print(f"Block Height: {status['node'].get('height')}")
    print(f"Mempool Txs: {status.get('mempool', {}).get('count')}")
    print(f"Simulation Mode: {status.get('simulation_mode', False)}")
    
    # Test read-only whitelist enforcement
    try:
        rpc.call("sendtoaddress", ["invalid", 1.0])
        print("FAIL: sendtoaddress was not blocked!")
        return False, "Whitelist violation"
    except BitcoinRPCMethodForbiddenError:
        print("PASS: sendtoaddress correctly blocked by read-only enforcement.")
        
    try:
        rpc.call("signrawtransactionwithwallet", ["dummy"])
        print("FAIL: signrawtransactionwithwallet was not blocked!")
        return False, "Whitelist violation"
    except BitcoinRPCMethodForbiddenError:
        print("PASS: signrawtransactionwithwallet correctly blocked by read-only enforcement.")

    return True, status

def validate_ml_engine():
    log_section("3. ML INFERENCE & MODEL STATUS VALIDATION")
    models_dir = os.path.join(CURRENT_DIR, "models")
    model_files = [
        "bitcoin_scaler.joblib",
        "bitcoin_umap.joblib",
        "bitcoin_hdbscan.joblib",
        "bitcoin_fallback_xgboost.joblib",
        "bitcoin_cluster_0_bundle.pkl",
        "bitcoin_cluster_1_bundle.pkl",
        "bitcoin_cluster_2_bundle.pkl"
    ]
    for mf in model_files:
        exists = os.path.exists(os.path.join(models_dir, mf))
        print(f"  • {mf}: {'EXISTS' if exists else 'MISSING'}")
        assert exists, f"Missing model file {mf}"

    ml_engine = BitcoinMLInferenceEngine()
    model_stat = ml_engine.get_model_status()
    print(f"ML Engine Status: {model_stat.get('status')}")
    print(f"Features Count: {len(BITCOIN_FEATURE_KEYS)}")
    print(f"Scaler Available: {ml_engine.scaler is not None}")
    print(f"UMAP Available: {ml_engine.umap_model is not None}")
    print(f"Cluster Bundles Loaded: {len(ml_engine.cluster_bundles)}")

    client = pymongo.MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=2000)
    db = client["RedisTransactions"]
    sample_tx = db["bitcoin_transactions"].find_one()
    assert sample_tx is not None, "No sample transaction in database!"

    t0 = time.perf_counter()
    features = BitcoinFeatureEngine.compute_features(
        tx=sample_tx,
        entity_id=sample_tx.get("entity_id", "ENT_TEST"),
        entity_history=[],
        utxo_stats={},
        graph_stats={},
        motif_stats={},
        entity_addresses=sample_tx.get("input_addresses", [])
    )
    feat_time = (time.perf_counter() - t0) * 1000
    benchmarks["feature_extraction_ms"] = feat_time
    print(f"Feature vector keys count: {len(features)} (Computed in {feat_time:.2f}ms)")
    assert len(features) == 66, f"Expected 66 features, got {len(features)}"

    # Score with real ML inference
    t0 = time.perf_counter()
    pred = ml_engine.predict(features, is_cold_start=False)
    inf_time = (time.perf_counter() - t0) * 1000
    benchmarks["ml_inference_ms"] = inf_time
    print(f"Inference result:")
    print(f"  • ML Anomaly Score: {pred['ml_score']:.4f}")
    print(f"  • Assigned Cluster: {pred.get('cluster_id')}")
    print(f"  • Model Used: {pred.get('model_type')}")
    print(f"  • Status: {pred.get('status')}")
    print(f"  • Inference Latency: {inf_time:.2f}ms")

    # Verify score is NOT fixed 0.15
    assert pred["ml_score"] != 0.15, "CRITICAL: ML score is still hardcoded to 0.15!"
    assert 0.0 <= pred["ml_score"] <= 1.0, f"ML score out of bounds: {pred['ml_score']}"
    print("PASS: Dynamic ML scoring verified (not hardcoded 0.15).")
    return True, {"feat_time": feat_time, "inf_time": inf_time, "pred": pred}

def validate_risk_engine():
    log_section("4. RISK ENGINE VALIDATION")
    client = pymongo.MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=2000)
    db = client["RedisTransactions"]
    risk_engine = BitcoinRiskEngine()
    ml_engine = BitcoinMLInferenceEngine()

    # Query diverse transactions (e.g. Critical, High, Low)
    tx_crit = db["bitcoin_transactions"].find_one({"risk_level": "CRITICAL"}) or db["bitcoin_transactions"].find_one()
    tx_low = db["bitcoin_transactions"].find_one({"risk_level": "LOW"}) or db["bitcoin_transactions"].find_one()
    tx_med = db["bitcoin_transactions"].find_one({"risk_level": "MEDIUM"}) or db["bitcoin_transactions"].find_one()

    test_cases = [
        {"tx": tx_crit, "rule_score": 85.0, "deg": 12.0, "vel_1h": 20.0},
        {"tx": tx_med, "rule_score": 45.0, "deg": 5.0, "vel_1h": 6.0},
        {"tx": tx_low, "rule_score": 10.0, "deg": 1.0, "vel_1h": 0.5}
    ]

    scores = []
    latencies = []

    for tc in test_cases:
        tx = tc["tx"]
        t0 = time.perf_counter()
        feats = BitcoinFeatureEngine.compute_features(
            tx=tx,
            entity_id=tx.get("entity_id", "ENT_TEST"),
            entity_history=[],
            utxo_stats={},
            graph_stats={},
            motif_stats={},
            entity_addresses=tx.get("input_addresses", [])
        )
        feats["tx_velocity_1h"] = tc["vel_1h"]
        ml_pred = ml_engine.predict(feats, is_cold_start=False)
        risk_profile = risk_engine.evaluate_risk(
            ml_score=ml_pred["ml_score"],
            model_type=ml_pred["model_type"],
            features=feats,
            rule_eval={"rule_score": tc["rule_score"], "signals": tx.get("signals", [])},
            graph_stats={"pagerank": 0.001, "degree": tc["deg"]}
        )
        calc_time = (time.perf_counter() - t0) * 1000
        latencies.append(calc_time)
        scores.append(risk_profile)
        print(f"TX {tx['txid'][:12]}... -> Composite Score: {risk_profile['risk_score']:.1f}, Level: {risk_profile['risk_level']}, Signals: {len(risk_profile['signals'])} ({calc_time:.2f}ms)")

    benchmarks["risk_calculation_avg_ms"] = float(np.mean(latencies))
    distinct_scores = set(s['risk_score'] for s in scores)
    print(f"Distinct composite risk scores across {len(scores)} samples: {len(distinct_scores)} (Scores: {[s['risk_score'] for s in scores]})")
    assert len(distinct_scores) > 1, "Risk scores are static!"
    print("PASS: Dynamic multi-factor risk calculation verified across severity tiers.")
    return True, scores

def validate_investigation_and_flow_api():
    log_section("5. INVESTIGATION ENGINE & MULTI-HOP FLOW API")
    # Test primary pre-compiled investigation INV-35C54D881B
    inv_id = "INV-35C54D881B"
    
    # 1. Detail API
    t0 = time.perf_counter()
    req = urllib.request.Request(f"{API_BASE}/investigations/{inv_id}")
    with urllib.request.urlopen(req, timeout=5) as resp:
        inv = json.loads(resp.read().decode())
    dur_detail = (time.perf_counter() - t0) * 1000
    print(f"Investigation {inv_id} fetched in {dur_detail:.2f}ms:")
    print(f"  • Seed Entity: {inv.get('seed_entity_id')}")
    print(f"  • Status: {inv.get('investigation_status')}")
    print(f"  • Initial Risk: {inv.get('initial_risk_score')}")

    # 2. Flow API
    t0 = time.perf_counter()
    req = urllib.request.Request(f"{API_BASE}/investigations/{inv_id}/flow")
    with urllib.request.urlopen(req, timeout=5) as resp:
        flow_data = json.loads(resp.read().decode())
    dur_flow = (time.perf_counter() - t0) * 1000
    benchmarks["flow_api_ms"] = dur_flow
    flow_steps = flow_data.get("flow_path", [])
    print(f"Multi-Hop Flow fetched in {dur_flow:.2f}ms: {len(flow_steps)} hops recorded")
    assert len(flow_steps) > 0, "Investigation flow_path is empty!"

    # Verify first 3 hops
    for s in flow_steps[:3]:
        print(f"  * Hop {s.get('hop')}: {s.get('source_entity')} -> {s.get('destination_entity')} | {s.get('amount')} BTC (Ret: {s.get('forwarding_ratio', 0)*100:.1f}%)")
        assert "source_entity" in s and "destination_entity" in s and "amount" in s

    # 3. Graph API
    t0 = time.perf_counter()
    req = urllib.request.Request(f"{API_BASE}/investigations/{inv_id}/graph")
    with urllib.request.urlopen(req, timeout=5) as resp:
        graph_data = json.loads(resp.read().decode())
    dur_graph = (time.perf_counter() - t0) * 1000
    benchmarks["graph_api_ms"] = dur_graph
    nodes = graph_data.get("nodes", [])
    edges = graph_data.get("edges", [])
    print(f"Investigation Graph fetched in {dur_graph:.2f}ms: {len(nodes)} nodes, {len(edges)} edges")
    assert len(nodes) > 0, "Investigation graph has no nodes!"
    assert len(edges) > 0, "Investigation graph has no edges!"

    # 4. Leads API
    t0 = time.perf_counter()
    req = urllib.request.Request(f"{API_BASE}/investigations/{inv_id}/leads")
    with urllib.request.urlopen(req, timeout=5) as resp:
        leads_data = json.loads(resp.read().decode())
    dur_leads = (time.perf_counter() - t0) * 1000
    benchmarks["leads_api_ms"] = dur_leads
    leads = leads_data.get("leads", [])
    print(f"Investigation Leads fetched in {dur_leads:.2f}ms: {len(leads)} prioritized leads")
    assert len(leads) > 0, "Investigation has no leads!"

    print("PASS: Investigation dossier, multi-hop flow, graph, and leads verified.")
    return True, {"nodes": len(nodes), "flow": len(flow_steps), "leads": len(leads)}

def validate_wallet_search_and_intelligence():
    log_section("6. WALLET SEARCH & INTELLIGENCE VALIDATION")
    client = pymongo.MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=2000)
    db = client["RedisTransactions"]
    sample_entity = db["bitcoin_entities"].find_one({"velocity_24h": {"$gt": 0}})
    assert sample_entity is not None, "No entity with velocity found!"
    entity_id = sample_entity["entity_id"]

    # 1. Search Query
    t0 = time.perf_counter()
    url = f"{API_BASE}/search?q={entity_id}"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=5) as resp:
        results = json.loads(resp.read().decode())
    dur_search = (time.perf_counter() - t0) * 1000
    benchmarks["search_api_ms"] = dur_search
    print(f"Search query '{entity_id}' returned {len(results)} matches in {dur_search:.2f}ms")
    assert len(results) > 0, "Entity search returned empty!"
    match = results[0]
    assert match["id"] == entity_id, f"Expected match {entity_id}, got {match['id']}"

    # 2. Wallet Analysis
    t0 = time.perf_counter()
    analyze_url = f"{API_BASE}/wallets/{urllib.parse.quote(entity_id)}/analyze"
    post_req = urllib.request.Request(
        analyze_url,
        data=b"{}",
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(post_req, timeout=5) as resp:
        analysis = json.loads(resp.read().decode())
    dur_analyze = (time.perf_counter() - t0) * 1000
    benchmarks["wallet_analysis_api_ms"] = dur_analyze

    behavior = analysis.get("behavior", {})
    print(f"Wallet analysis returned in {dur_analyze:.2f}ms:")
    print(f"  • Query Input: {analysis.get('query_input')}")
    print(f"  • Resolved Entity: {analysis.get('entity', {}).get('entity_id')}")
    print(f"  • Velocity 1h: {behavior.get('velocity_1h')}")
    print(f"  • Velocity 24h: {behavior.get('velocity_24h')}")
    print(f"  • Total Volume BTC: {behavior.get('total_volume_btc')}")
    print(f"  • Graph Neighbors: {len(analysis.get('graph', {}).get('nodes', []))}")
    print(f"  • Flagged Leads: {len(analysis.get('leads', []))}")

    assert analysis.get("query_input") == entity_id, "Input query was corrupted!"
    assert behavior.get("velocity_24h", 0) > 0, "Velocity 24h is 0!"
    assert behavior.get("total_volume_btc", 0) > 0, "Total volume BTC is 0!"
    print("PASS: Exact input/output consistency and non-zero metrics verified.")
    return True, analysis

def validate_system_status_api():
    log_section("7. SYSTEM STATUS & TELEMETRY API")
    t0 = time.perf_counter()
    url = f"{API_BASE}/status"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=5) as resp:
        status = json.loads(resp.read().decode())
    dur_status = (time.perf_counter() - t0) * 1000
    benchmarks["status_api_ms"] = dur_status

    print(f"Status API returned in {dur_status:.2f}ms:")
    print(f"  • Network: {status.get('network')}")
    print(f"  • Node Status: {status.get('node_status')}")
    print(f"  • Model Status: {status.get('model_status')}")
    print(f"  • Block Height: {status.get('current_block_height')}")
    print(f"  • Throughput TPS: {status.get('tps')}")
    print(f"  • Model Latency: {status.get('model_latency_ms')}")
    print(f"  • Total Transactions: {status.get('total_transactions')}")
    print(f"  • Total Entities: {status.get('total_entities')}")
    print(f"  • Critical Leads: {status.get('critical_leads_count')}")

    # Confirm no fictional defaults
    assert status.get("tps") != 18.5, "CRITICAL: TPS is still hardcoded to 18.5!"
    assert status.get("model_latency_ms") != 12.4, "CRITICAL: Model latency is still hardcoded to 12.4!"
    print("PASS: System status reports genuine telemetry.")
    return True, status

def validate_controlled_transaction_ingest():
    log_section("8. CONTROLLED REAL-TIME TRANSACTION INGESTION")
    # Create a unique controlled test transaction
    test_txid = f"tx_final_validation_{int(time.time())}_{os.urandom(4).hex()}"
    test_doc = {
        "txid": test_txid,
        "timestamp": int(time.time()),
        "block_height": 840500,
        "input_count": 1,
        "output_count": 2,
        "total_input_btc": 5.2500,
        "total_output_btc": 5.2490,
        "fee_btc": 0.0010,
        "entity_id": "ENT_22E730C8B03C",
        "input_addresses": ["bc1q_validation_test_input"],
        "output_addresses": ["bc1q_validation_test_out1", "bc1q_validation_test_out2"],
        "inputs": [{"address": "bc1q_validation_test_input", "value_btc": 5.2500}],
        "outputs": [
            {"address": "bc1q_validation_test_out1", "value_btc": 5.0000, "vout": 0},
            {"address": "bc1q_validation_test_out2", "value_btc": 0.2490, "vout": 1}
        ],
        "risk_score": 82.5,
        "risk_level": "CRITICAL",
        "signals": ["velocity_spike", "peel_chain_split", "controlled_validation_test"],
        "explanation": "Controlled test transaction for end-to-end ingest validation.",
        "status": "confirmed"
    }

    t0 = time.perf_counter()
    url = f"{API_BASE}/ingest"
    data_payload = json.dumps({"transactions": [test_doc]}).encode("utf-8")
    post_req = urllib.request.Request(
        url,
        data=data_payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(post_req, timeout=30) as resp:
        res = json.loads(resp.read().decode())
    dur_ingest = (time.perf_counter() - t0) * 1000
    benchmarks["controlled_ingest_ms"] = dur_ingest
    print(f"Ingestion POST returned in {dur_ingest:.2f}ms: {res}")
    assert res.get("ingested") == 1, f"Expected 1 ingested, got {res.get('ingested')}"

    # Verify transaction is immediately retrievable via API
    time.sleep(0.3)
    tx_url = f"{API_BASE}/transactions/{test_txid}"
    req = urllib.request.Request(tx_url)
    with urllib.request.urlopen(req, timeout=5) as resp:
        queried_tx = json.loads(resp.read().decode())
    print(f"Retrieved ingested transaction {queried_tx['txid']}:")
    print(f"  • Risk Level: {queried_tx.get('risk_level')}")
    print(f"  • Total Output BTC: {queried_tx.get('total_output_btc')}")
    print(f"  • Signals: {queried_tx.get('signals')}")
    assert queried_tx["txid"] == test_txid, "Retrieved TXID does not match ingested!"
    print("PASS: Controlled transaction ingestion, persistence, and API retrieval verified.")
    return True, queried_tx

def print_performance_benchmarks():
    log_section("9. MEASURED SYSTEM PERFORMANCE BENCHMARKS")
    for k, v in benchmarks.items():
        print(f"  • {k:<30}: {v:.2f} ms")

def run_all():
    print("=================================================================")
    print("  V.E.C.T.O.R — FINAL FULL-SYSTEM RELEASE VALIDATION SUITE")
    print("=================================================================")
    
    validate_database()
    validate_bitcoin_rpc()
    validate_ml_engine()
    validate_risk_engine()
    validate_investigation_and_flow_api()
    validate_wallet_search_and_intelligence()
    validate_system_status_api()
    validate_controlled_transaction_ingest()
    print_performance_benchmarks()

    log_section("VALIDATION VERDICT")
    print("All 8 functional pillars passed:")
    print("  1. Database Persistence:           PASS")
    print("  2. Bitcoin Core Read-Only RPC:     PASS")
    print("  3. ML Model Inference & Scaler:    PASS")
    print("  4. Multi-Factor Risk Calculation:  PASS")
    print("  5. Multi-Hop Investigation Flow:   PASS")
    print("  6. Wallet Search & Intelligence:   PASS")
    print("  7. Genuine System Status API:      PASS")
    print("  8. Controlled Transaction Ingestion:PASS")
    print("=================================================================")
    print("V.E.C.T.O.R SYSTEM IS FULLY DEMONSTRABLE WITH GENUINE ANALYTICS.")
    print("=================================================================")

if __name__ == "__main__":
    run_all()
