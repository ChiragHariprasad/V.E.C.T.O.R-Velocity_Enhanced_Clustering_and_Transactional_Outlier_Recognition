"""
V.E.C.T.O.R Investigation Execution Service
Executes the analytical InvestigationEngine on-demand for a given seed entity or transaction.
Loads neighborhood transactions from MongoDB (or passed arguments), crawls the transaction
graph, identifies behavioral roles, matches patterns, ranks investigative leads,
persists the completed investigation to MongoDB, and returns JSON output.
"""

import os
import sys
import json
import argparse
import logging
from typing import Dict, Any, List, Optional
import pymongo

from bitcoin.config import MONGO_URI, MONGO_DB_NAME
from bitcoin.entity_profiler import EntityProfiler
from bitcoin.transaction_graph import BitcoinTransactionGraph
from bitcoin.risk_engine import BitcoinRiskEngine
from bitcoin.utxo_manager import UTXOManager
from bitcoin.investigation_engine import InvestigationEngine

logger = logging.getLogger("VECTOR.RunInvestigation")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")


def execute_investigation(
    seed_entity_id: Optional[str] = None,
    seed_txid: Optional[str] = None,
    investigation_id: Optional[str] = None,
    title: Optional[str] = None,
    priority: Optional[str] = None,
    notes: Optional[str] = None,
    mongo_uri: str = MONGO_URI,
    db_name: str = MONGO_DB_NAME,
    max_neighborhood_txs: int = 300,
) -> Dict[str, Any]:
    """
    Run full graph investigation on a suspicious seed entity or transaction.
    """
    client = pymongo.MongoClient(mongo_uri, serverSelectionTimeoutMS=3000)
    db = client[db_name]

    # Resolve seed entity if only txid given
    if seed_txid and not seed_entity_id:
        tx_doc = db.bitcoin_transactions.find_one({"txid": seed_txid})
        if tx_doc:
            seed_entity_id = tx_doc.get("entity_id")

    if not seed_entity_id and not seed_txid:
        raise ValueError("Must provide at least seed_entity_id or seed_txid")

    # Step 1: Collect seed and neighborhood transactions from MongoDB
    query_conditions = []
    if seed_entity_id:
        query_conditions.append({"entity_id": seed_entity_id})
    if seed_txid:
        query_conditions.append({"txid": seed_txid})

    seed_txs = list(db.bitcoin_transactions.find({"$or": query_conditions}).limit(50))

    # Collect counterparty addresses to gather 1-hop neighborhood
    counterparty_addrs = set()
    for tx in seed_txs:
        for a in tx.get("input_addresses", []) + tx.get("output_addresses", []):
            counterparty_addrs.add(a)

    neighborhood_txs = []
    if counterparty_addrs:
        addr_list = list(counterparty_addrs)[:100]
        neighbor_query = {
            "$or": [
                {"input_addresses": {"$in": addr_list}},
                {"output_addresses": {"$in": addr_list}}
            ]
        }
        neighborhood_txs = list(
            db.bitcoin_transactions.find(neighbor_query).limit(max_neighborhood_txs)
        )

    # Combine and deduplicate transactions
    seen_txids = set()
    all_txs: List[Dict[str, Any]] = []
    for tx in seed_txs + neighborhood_txs:
        txid = tx.get("txid")
        if txid and txid not in seen_txids:
            seen_txids.add(txid)
            all_txs.append({k: v for k, v in tx.items() if k != "_id"})

    if not all_txs:
        # If no transactions in DB, create minimal anchor transaction so investigation can still analyze
        fallback_txid = seed_txid or f"syn_{seed_entity_id[:8] if seed_entity_id else '0000'}"
        all_txs.append({
            "txid": fallback_txid,
            "entity_id": seed_entity_id or "ENT_UNKNOWN",
            "input_addresses": [seed_entity_id] if seed_entity_id else ["addr_anchor"],
            "output_addresses": ["addr_anchor_out"],
            "inputs": [{"address": seed_entity_id or "addr_anchor", "value_btc": 1.0}],
            "outputs": [{"address": "addr_anchor_out", "value_btc": 0.99}],
            "total_input_btc": 1.0,
            "total_output_btc": 0.99,
            "fee_btc": 0.01,
            "timestamp": 1700000000,
            "status": "confirmed",
        })

    # Step 2: Initialize analytics components
    entity_profiler = EntityProfiler()
    graph = BitcoinTransactionGraph()
    risk_engine = BitcoinRiskEngine()
    utxo_mgr = UTXOManager()

    for tx in all_txs:
        input_addrs = tx.get("input_addresses", [])
        primary = input_addrs[0] if input_addrs else "unknown"
        eid = tx.get("entity_id") or entity_profiler.get_or_create_entity(input_addrs, primary)
        tx["entity_id"] = eid
        graph.add_transaction(tx, entity_id=eid)
        utxo_mgr.process_transaction(tx)

    graph.compute_centralities()

    # Step 3: Run Investigation Engine
    engine = InvestigationEngine(
        graph=graph,
        entity_profiler=entity_profiler,
        risk_engine=risk_engine,
        utxo_manager=utxo_mgr,
        processed_txs=all_txs,
    )

    inv = engine.create_investigation(
        seed_txid=seed_txid,
        seed_entity_id=seed_entity_id,
        trigger_reasons=["manual_analyst_dispatch"]
    )

    if investigation_id:
        inv["investigation_id"] = investigation_id
    if title:
        inv["title"] = title
    if priority:
        inv["priority"] = priority
    if notes:
        inv["notes"] = notes

    inv = engine.run_investigation(inv)

    # Step 4: Persist to MongoDB
    clean_inv = {k: v for k, v in inv.items() if k != "_id"}
    db.bitcoin_investigations.replace_one(
        {"investigation_id": clean_inv["investigation_id"]},
        clean_inv,
        upsert=True
    )

    client.close()
    return clean_inv


def main():
    parser = argparse.ArgumentParser(description="V.E.C.T.O.R Investigation Runner")
    parser.add_argument("--seed-entity", help="Seed entity identifier (e.g. ENT_XXXXXXXXXXXX)")
    parser.add_argument("--seed-txid", help="Seed Bitcoin transaction ID (64-char hex)")
    parser.add_argument("--investigation-id", help="Optional specific investigation ID to update")
    parser.add_argument("--title", default="Targeted Entity Investigation", help="Investigation title")
    parser.add_argument("--priority", default="HIGH", help="Priority (CRITICAL, HIGH, MEDIUM, LOW)")
    parser.add_argument("--notes", default="", help="Analyst notes")
    args = parser.parse_args()

    try:
        inv = execute_investigation(
            seed_entity_id=args.seed_entity,
            seed_txid=args.seed_txid,
            investigation_id=args.investigation_id,
            title=args.title,
            priority=args.priority,
            notes=args.notes,
        )
        print(json.dumps(inv, default=str))
    except Exception as e:
        logger.error(f"Investigation execution failed: {e}", exc_info=True)
        error_doc = {
            "error": str(e),
            "investigation_status": "FAILED",
            "seed_entity_id": args.seed_entity,
            "seed_transaction_id": args.seed_txid,
        }
        print(json.dumps(error_doc), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
