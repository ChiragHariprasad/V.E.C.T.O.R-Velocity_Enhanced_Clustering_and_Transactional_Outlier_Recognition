"""
V.E.C.T.O.R Transaction Ingestion & Analytical Pipeline Service
Takes raw or pre-formatted Bitcoin transactions, executes the full analytical pipeline:
  Normalization -> Entity Resolution -> Graph -> UTXO -> 66D Features ->
  ML Inference -> Rules -> Composite Risk Engine -> Safe MongoDB Upsert -> Real-Time Output.

CLI usage:
  python -m bitcoin.analyze_transaction --json '[{...}]'
  python -m bitcoin.analyze_transaction --input transactions.json
  python -m bitcoin.analyze_transaction --stdin
"""

import sys
import os
import json
import time
import argparse
import logging
from typing import Dict, Any, List
from datetime import datetime, timezone
import pymongo

from bitcoin.config import MONGO_URI, MONGO_DB_NAME
from bitcoin.bulk_ingest import _normalize_row
from bitcoin.entity_profiler import EntityProfiler
from bitcoin.transaction_graph import BitcoinTransactionGraph
from bitcoin.utxo_manager import UTXOManager
from bitcoin.bitcoin_rules import BitcoinRulesEngine
from bitcoin.bitcoin_features import BitcoinFeatureEngine
from bitcoin.ml_inference import BitcoinMLInferenceEngine
from bitcoin.risk_engine import BitcoinRiskEngine
from bitcoin.schemas import get_risk_level

logger = logging.getLogger("VECTOR.AnalyzeTransaction")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")


def analyze_and_ingest_transactions(
    raw_transactions: List[Dict[str, Any]],
    persist_to_mongo: bool = True,
    mongo_uri: str = MONGO_URI,
    db_name: str = MONGO_DB_NAME,
) -> Dict[str, Any]:
    """
    Run raw transactions through the entire analytical intelligence pipeline and persist.
    """
    if not raw_transactions:
        return {"ingested_count": 0, "transactions": [], "alerts": []}

    t0 = time.perf_counter()

    # Step 1: Connect to MongoDB if persistence requested
    db = None
    if persist_to_mongo:
        try:
            client = pymongo.MongoClient(mongo_uri, serverSelectionTimeoutMS=2000)
            db = client[db_name]
        except Exception as e:
            logger.warning(f"MongoDB unavailable for ingestion: {e}")
            db = None

    # Step 2: Initialize analytics components
    entity_profiler = EntityProfiler()
    graph = BitcoinTransactionGraph()
    utxo_mgr = UTXOManager()
    risk_engine = BitcoinRiskEngine()
    ml_engine = BitcoinMLInferenceEngine()

    # Step 3: Normalize and resolve entities
    normalized_txs = []
    for raw in raw_transactions:
        # If already normalized format, preserve existing fields; otherwise normalize
        if "inputs" in raw and "outputs" in raw and "txid" in raw:
            tx = dict(raw)
            if not tx.get("timestamp"):
                tx["timestamp"] = int(time.time())
            if not tx.get("status"):
                tx["status"] = "confirmed"
        else:
            tx = _normalize_row(raw)
        
        input_addrs = tx.get("input_addresses", [])
        primary = input_addrs[0] if input_addrs else "unknown"
        entity_id = tx.get("entity_id") or entity_profiler.get_or_create_entity(input_addrs, primary)
        tx["entity_id"] = entity_id

        graph.add_transaction(tx, entity_id=entity_id)
        normalized_txs.append(tx)

    graph.compute_centralities()

    # Step 4: Run Feature Extraction, ML Inference, and Risk Scoring
    analyzed_txs: List[Dict[str, Any]] = []
    alert_queue: List[Dict[str, Any]] = []
    entity_updates: Dict[str, Dict[str, Any]] = {}

    for tx in normalized_txs:
        entity_id = tx["entity_id"]
        
        # UTXO stats
        utxo_stats = utxo_mgr.process_transaction(tx)

        # Graph features
        graph_stats = graph.get_node_features(entity_id)
        motif_stats = graph.detect_motifs(tx)

        # Behavioral heuristics
        rule_eval = BitcoinRulesEngine.evaluate_heuristics(tx, utxo_stats=utxo_stats)

        # Historical context from DB if available
        history: List[Dict[str, Any]] = []
        if db is not None:
            try:
                history = list(
                    db.bitcoin_transactions.find({"entity_id": entity_id})
                    .sort("timestamp", -1)
                    .limit(20)
                )
            except Exception:
                history = []

        # 66D Feature Vector
        features = BitcoinFeatureEngine.compute_features(
            tx=tx,
            entity_id=entity_id,
            entity_history=history,
            utxo_stats=utxo_stats,
            graph_stats=graph_stats,
            motif_stats=motif_stats,
            entity_addresses=entity_profiler.get_entity_addresses(entity_id),
        )

        # Real ML Inference
        is_cold_start = (len(history) < 2)
        ml_result = ml_engine.predict(features, is_cold_start=is_cold_start)
        ml_score = ml_result.get("ml_score")
        model_type = ml_result.get("model_type", "ML_UNAVAILABLE")
        cluster_id = ml_result.get("cluster_id")

        # Multi-model risk scoring
        risk_eval = risk_engine.evaluate_risk(
            ml_score=ml_score,
            model_type=model_type,
            features=features,
            rule_eval=rule_eval,
            graph_stats=graph_stats,
        )

        # Risk level classification
        risk_score = risk_eval["risk_score"]
        risk_level = get_risk_level(risk_score)
        risk_eval["risk_level"] = risk_level

        # Enrich transaction
        tx["risk_score"] = risk_score
        tx["risk_level"] = risk_level
        tx["risk_components"] = risk_eval["components"]
        tx["signals"] = risk_eval["signals"]
        tx["explanation"] = risk_eval["explanation"]
        tx["cluster_id"] = cluster_id
        tx["ml_model_type"] = model_type
        tx["analyzed_at"] = datetime.now(timezone.utc).isoformat()

        analyzed_txs.append(tx)

        # High risk alert
        if risk_score >= 50.0:
            alert = {
                "lead_id": f"LEAD_{tx['txid'][:10].upper()}",
                "txid": tx["txid"],
                "entity_id": entity_id,
                "risk_score": risk_score,
                "risk_level": risk_level,
                "signals": risk_eval["signals"],
                "explanation": risk_eval["explanation"],
                "pattern": tx.get("pattern", "unknown"),
                "timestamp": tx.get("timestamp"),
                "geo_country": tx.get("geo_country", "UNKNOWN"),
            }
            alert_queue.append(alert)

        # Track entity profile
        if entity_id not in entity_updates:
            addrs = list(set(entity_profiler.get_entity_addresses(entity_id)))
            entity_updates[entity_id] = {
                "entity_id": entity_id,
                "primary_address": addrs[0] if addrs else "",
                "addresses": addrs,
                "risk_score": risk_score,
                "risk_level": risk_level,
                "cluster_id": cluster_id,
                "last_seen": tx.get("timestamp"),
            }
        else:
            entity_updates[entity_id]["risk_score"] = max(
                entity_updates[entity_id]["risk_score"], risk_score
            )
            entity_updates[entity_id]["risk_level"] = get_risk_level(
                entity_updates[entity_id]["risk_score"]
            )

    # Step 5: Safe Persistence to MongoDB (Upsert, never wipe)
    if db is not None:
        from pymongo import UpdateOne

        # 1. Transactions
        tx_ops = [
            UpdateOne({"txid": tx["txid"]}, {"$set": {k: v for k, v in tx.items() if k != "_id"}}, upsert=True)
            for tx in analyzed_txs
        ]
        if tx_ops:
            db.bitcoin_transactions.bulk_write(tx_ops, ordered=False)

        # 2. Entity updates
        entity_ops = [
            UpdateOne(
                {"entity_id": eid},
                {
                    "$set": {k: v for k, v in prof.items() if k != "addresses"},
                    "$addToSet": {"addresses": {"$each": prof["addresses"]}},
                    "$inc": {"tx_count": 1}
                },
                upsert=True
            )
            for eid, prof in entity_updates.items()
        ]
        if entity_ops:
            db.bitcoin_entities.bulk_write(entity_ops, ordered=False)

        # 3. Alerts
        if alert_queue:
            alert_ops = [
                UpdateOne({"txid": a["txid"]}, {"$set": a}, upsert=True)
                for a in alert_queue
            ]
            db.bitcoin_risk_events.bulk_write(alert_ops, ordered=False)

    elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
    return {
        "status": "SUCCESS",
        "ingested_count": len(analyzed_txs),
        "alerts_count": len(alert_queue),
        "elapsed_ms": elapsed_ms,
        "transactions": analyzed_txs,
        "alerts": alert_queue,
    }


def main():
    parser = argparse.ArgumentParser(description="V.E.C.T.O.R Analyze & Ingest Service")
    parser.add_argument("--json", help="JSON array or object of transactions")
    parser.add_argument("--input", help="Path to JSON file containing transactions")
    parser.add_argument("--stdin", action="store_true", help="Read JSON from stdin")
    parser.add_argument("--no-persist", action="store_true", help="Do not persist to MongoDB")
    args = parser.parse_args()

    raw_data = None
    if args.json:
        raw_data = json.loads(args.json)
    elif args.input:
        with open(args.input, "r", encoding="utf-8") as f:
            raw_data = json.load(f)
    elif args.stdin:
        raw_data = json.loads(sys.stdin.read())
    else:
        print(json.dumps({"error": "No input provided. Use --json, --input, or --stdin."}), file=sys.stderr)
        sys.exit(1)

    if isinstance(raw_data, dict):
        if "transactions" in raw_data:
            txs = raw_data["transactions"]
        else:
            txs = [raw_data]
    elif isinstance(raw_data, list):
        txs = raw_data
    else:
        print(json.dumps({"error": "Input must be a transaction object or array"}), file=sys.stderr)
        sys.exit(1)

    try:
        result = analyze_and_ingest_transactions(txs, persist_to_mongo=not args.no_persist)
        print(json.dumps(result, default=str))
    except Exception as e:
        logger.error(f"Ingestion analysis failed: {e}", exc_info=True)
        print(json.dumps({"status": "FAILED", "error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
