"""
V.E.C.T.O.R-BITCOIN Bulk Ingestion Engine
Parses CSV/JSON/XML datasets conforming to the NTRO problem-statement schema,
maps them to the internal transaction format, and runs each record through
the full V.E.C.T.O.R pipeline:
  Parse → Graph → Features → Rules → Risk → IP Correlation → Risk Propagation → Persist

CLI usage:
  python -m bitcoin.bulk_ingest --input bitcoin_dataset.csv --format csv
"""

import os
import csv
import json
import hashlib
import argparse
import logging
import time
from typing import Dict, Any, List, Optional, Set, Tuple
from datetime import datetime, timezone

# Core pipeline components
from bitcoin.entity_profiler import EntityProfiler
from bitcoin.transaction_graph import BitcoinTransactionGraph
from bitcoin.bitcoin_features import BitcoinFeatureEngine
from bitcoin.bitcoin_rules import BitcoinRulesEngine
from bitcoin.risk_engine import BitcoinRiskEngine
from bitcoin.utxo_manager import UTXOManager
from bitcoin.ip_correlator import IPWalletCorrelator
from bitcoin.risk_propagation import RiskPropagationEngine
from bitcoin.schemas import BITCOIN_FEATURE_KEYS, get_risk_level
from bitcoin.investigation_engine import InvestigationTrigger, InvestigationEngine
from bitcoin.ml_inference import BitcoinMLInferenceEngine, ML_UNAVAILABLE

logger = logging.getLogger("VECTOR.BulkIngest")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")


# ---------------------------------------------------------------------------
# Parsers for each input format
# ---------------------------------------------------------------------------

def _parse_list_field(value) -> List[str]:
    """Parse a list field that might be semicolon-separated string or actual list."""
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        if value.startswith("["):
            try:
                return json.loads(value.replace("'", '"'))
            except (json.JSONDecodeError, ValueError):
                pass
        return [v.strip() for v in value.split(";") if v.strip()]
    return []


def _parse_float_list(value) -> List[float]:
    """Parse a list of floats from string or list."""
    raw = _parse_list_field(value)
    result = []
    for v in raw:
        try:
            result.append(float(v))
        except (ValueError, TypeError):
            result.append(0.0)
    return result


def parse_csv(filepath: str) -> List[Dict[str, Any]]:
    """Parse NTRO-schema CSV file."""
    logger.info(f"Parsing CSV: {filepath}")
    transactions = []
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            tx = _normalize_row(row)
            transactions.append(tx)
    logger.info(f"Parsed {len(transactions)} transactions from CSV")
    return transactions


def parse_json(filepath: str) -> List[Dict[str, Any]]:
    """Parse NTRO-schema JSON file."""
    logger.info(f"Parsing JSON: {filepath}")
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Support both flat array and nested {"transactions": [...]} format
    if isinstance(data, list):
        raw_txs = data
    elif isinstance(data, dict) and "transactions" in data:
        raw_txs = data["transactions"]
    else:
        raise ValueError("JSON must be an array or an object with a 'transactions' key")

    transactions = [_normalize_row(row) for row in raw_txs]
    logger.info(f"Parsed {len(transactions)} transactions from JSON")
    return transactions


def parse_xml(filepath: str) -> List[Dict[str, Any]]:
    """Parse NTRO-schema XML file."""
    logger.info(f"Parsing XML: {filepath}")
    import xml.etree.ElementTree as ET
    tree = ET.parse(filepath)
    root = tree.getroot()

    transactions = []
    # Find all <transaction> elements regardless of nesting
    for tx_elem in root.iter("transaction"):
        row = {}
        for child in tx_elem:
            tag = child.tag
            # Check if it has sub-elements (list field)
            items = list(child)
            if items:
                row[tag] = [item.text or "" for item in items]
            else:
                row[tag] = child.text or ""
        tx = _normalize_row(row)
        transactions.append(tx)

    logger.info(f"Parsed {len(transactions)} transactions from XML")
    return transactions


def _normalize_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize a raw row from any format into the internal transaction format."""
    input_addrs = _parse_list_field(row.get("input_addresses", []))
    output_addrs = _parse_list_field(row.get("output_addresses", []))
    input_amts = _parse_float_list(row.get("input_amounts", []))
    output_amts = _parse_float_list(row.get("output_amounts", []))

    total_input = sum(input_amts) if input_amts else 0.0
    total_output = sum(output_amts) if output_amts else 0.0
    fee = float(row.get("fee", 0.0))

    # Parse timestamp
    ts_str = row.get("timestamp", "")
    ts_epoch = 0
    if ts_str:
        try:
            ts_epoch = int(datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S").timestamp())
        except (ValueError, TypeError):
            try:
                ts_epoch = int(float(ts_str))
            except (ValueError, TypeError):
                ts_epoch = int(time.time())

    txid = row.get("txid", "")

    # Build internal format matching what block_processor expects
    inputs = []
    for i, addr in enumerate(input_addrs):
        inputs.append({
            "address": addr,
            "value_btc": input_amts[i] if i < len(input_amts) else 0.0,
            "script_type": row.get("script_type", "P2WPKH"),
            "prev_txid": hashlib.sha256(f"prev_{txid}_{i}".encode()).hexdigest() if txid else f"synthetic_prev_{i}",
            "prev_vout": i,
        })

    outputs = []
    for i, addr in enumerate(output_addrs):
        outputs.append({
            "address": addr,
            "value_btc": output_amts[i] if i < len(output_amts) else 0.0,
            "vout": i,
            "script_type": row.get("script_type", "P2WPKH"),
            "is_op_return": False,
        })

    # Parse block height: use source data if present, otherwise None (do not fabricate 840000)
    raw_height = row.get("block_height") or row.get("height")
    block_height = None
    if raw_height is not None and str(raw_height).strip() != "":
        try:
            block_height = int(raw_height)
        except (ValueError, TypeError):
            block_height = None

    return {
        "txid": txid,
        "timestamp": ts_epoch,
        "timestamp_str": ts_str,
        "block_height": block_height,
        "block_hash": "",
        "version": 2,
        "size": 250,
        "vsize": 180,
        "weight": 720,
        "input_count": int(row.get("input_count", len(inputs))),
        "output_count": int(row.get("output_count", len(outputs))),
        "total_input_btc": round(total_input, 6),
        "total_output_btc": round(total_output, 6),
        "fee_btc": round(fee, 6),
        "inputs": inputs,
        "outputs": outputs,
        "input_addresses": input_addrs,
        "output_addresses": output_addrs,
        "status": "confirmed",
        # Network-layer fields
        "src_ip": row.get("src_ip", "0.0.0.0"),
        "dst_ip": row.get("dst_ip", "0.0.0.0"),
        "src_port": int(row.get("src_port", 8333)),
        "dst_port": int(row.get("dst_port", 8333)),
        "geo_country": row.get("geo_country", "UNKNOWN"),
        "asn": row.get("asn", "AS0"),
        # Metadata
        "script_type": row.get("script_type", "P2WPKH"),
        "pattern": row.get("pattern", "unknown"),
        "is_illicit": str(row.get("is_illicit", "false")).lower() in ("true", "1", "yes"),
        "source_entity_id": row.get("entity_id", ""),
    }


# ---------------------------------------------------------------------------
# Bulk Processing Pipeline
# ---------------------------------------------------------------------------

class BulkIngestPipeline:
    """
    Full V.E.C.T.O.R bulk ingestion pipeline.
    Processes all transactions through graph, features, rules, risk, IP correlation,
    and risk propagation.
    """

    def __init__(self, persist_to_mongo: bool = True, drop_existing: bool = False):
        self.entity_profiler = EntityProfiler()
        self.graph = BitcoinTransactionGraph()
        self.risk_engine = BitcoinRiskEngine()
        self.utxo_mgr = UTXOManager()
        self.ip_correlator = IPWalletCorrelator()
        self.risk_propagation = RiskPropagationEngine()
        self.ml_inference = BitcoinMLInferenceEngine()
        self.persist = persist_to_mongo
        self.drop_existing = drop_existing

        self.db = None
        if persist_to_mongo:
            try:
                import pymongo
                from bitcoin.config import MONGO_URI, MONGO_DB_NAME
                client = pymongo.MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
                client.admin.command("ping")
                self.db = client[MONGO_DB_NAME]
                logger.info("Connected to MongoDB for persistence")
            except Exception as e:
                logger.warning(f"MongoDB not available: {e}. Results will only be in-memory.")
                self.db = None

        self.processed_txs: List[Dict[str, Any]] = []
        self.alert_queue: List[Dict[str, Any]] = []
        self.investigations: List[Dict[str, Any]] = []

    def ingest(self, transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Process all transactions through the complete V.E.C.T.O.R pipeline.
        Returns summary statistics.
        """
        logger.info(f"🚀 Starting bulk ingestion of {len(transactions)} transactions...")
        start_time = time.time()
        self._ingest_start_time = start_time

        # Phase 1: Entity resolution & graph construction
        logger.info("Phase 1/5: Entity resolution & graph construction...")
        for tx in transactions:
            # Derive entity from input addresses
            input_addrs = tx.get("input_addresses", [])
            primary = input_addrs[0] if input_addrs else (tx["output_addresses"][0] if tx.get("output_addresses") else "unknown")
            entity_id = self.entity_profiler.get_or_create_entity(input_addrs, primary)
            tx["entity_id"] = entity_id

            # Add to graph
            self.graph.add_transaction(tx, entity_id=entity_id)

            # IP correlation
            self.ip_correlator.record_observation(
                src_ip=tx.get("src_ip", ""),
                dst_ip=tx.get("dst_ip", ""),
                txid=tx["txid"],
                timestamp=tx.get("timestamp_str", ""),
                input_addresses=tx.get("input_addresses", []),
                output_addresses=tx.get("output_addresses", []),
                entity_id=entity_id,
                geo_country=tx.get("geo_country"),
                total_btc=tx.get("total_output_btc", 0.0),
            )

            # Build risk propagation graph
            self.risk_propagation.build_from_transactions([tx])

        # Phase 2: Compute graph centralities
        logger.info("Phase 2/5: Computing graph centralities...")
        self.graph.compute_centralities()

        # Phase 3: Seed illicit entities for risk propagation
        logger.info("Phase 3/5: Seeding risk propagation...")
        illicit_entities = set()
        for tx in transactions:
            if tx.get("is_illicit"):
                illicit_entities.add(tx["entity_id"])
        for eid in illicit_entities:
            self.risk_propagation.seed_illicit(eid, risk=1.0)
        logger.info(f"   Seeded {len(illicit_entities)} illicit entities")

        # Phase 4: Risk propagation
        logger.info("Phase 4/5: Propagating risk scores...")
        self.risk_propagation.propagate()

        # Phase 5: Feature extraction, rules, risk scoring, and persistence
        logger.info("Phase 5/5: Feature extraction, ML scoring & persistence...")
        entity_history_map: Dict[str, List[Dict[str, Any]]] = {}
        for i, tx in enumerate(transactions):
            entity_id = tx["entity_id"]
            history = entity_history_map.get(entity_id, [])
            entity_addrs = self.entity_profiler.get_entity_addresses(entity_id)

            # UTXO stats
            utxo_stats = self.utxo_mgr.process_transaction(tx)

            # Graph features
            graph_stats = self.graph.get_node_features(entity_id)
            motif_stats = self.graph.detect_motifs(tx)

            # Behavioral rules
            rule_eval = BitcoinRulesEngine.evaluate_heuristics(tx, utxo_stats=utxo_stats)

            # Feature engineering with actual historical context and entity addresses
            features = BitcoinFeatureEngine.compute_features(
                tx=tx,
                entity_id=entity_id,
                entity_history=history,
                utxo_stats=utxo_stats,
                graph_stats=graph_stats,
                motif_stats=motif_stats,
                entity_addresses=entity_addrs,
            )

            # Record in entity history map
            if entity_id not in entity_history_map:
                entity_history_map[entity_id] = []
            entity_history_map[entity_id].append(tx)

            # Real ML Model Inference via V.E.C.T.O.R Pipeline
            # (StandardScaler -> UMAP -> HDBSCAN -> Cluster Isolation Forest / XGBoost Fallback)
            is_cold_start = (len(history) < 2)
            ml_result = self.ml_inference.predict(features, is_cold_start=is_cold_start)
            ml_score = ml_result.get("ml_score")
            model_type = ml_result.get("model_type", "ML_UNAVAILABLE")
            cluster_id = ml_result.get("cluster_id")

            propagated_risk = self.risk_propagation.get_risk_score(entity_id)

            # Multi-model risk scoring
            risk_eval = self.risk_engine.evaluate_risk(
                ml_score=ml_score,
                model_type=model_type,
                features=features,
                rule_eval=rule_eval,
                graph_stats=graph_stats,
            )

            # Add propagated risk contribution and reclassify using canonical get_risk_level
            final_risk = min(100.0, risk_eval["risk_score"] + propagated_risk * 15.0)
            risk_eval["risk_score"] = round(final_risk, 2)
            risk_eval["risk_level"] = get_risk_level(final_risk)

            # Enrich transaction
            tx["risk_score"] = risk_eval["risk_score"]
            tx["risk_level"] = risk_eval["risk_level"]
            tx["risk_components"] = risk_eval["components"]
            tx["signals"] = risk_eval["signals"]
            tx["explanation"] = risk_eval["explanation"]
            tx["propagated_risk"] = round(propagated_risk, 4)
            tx["propagation_path"] = self.risk_propagation.get_propagation_path(entity_id)
            tx["cluster_id"] = cluster_id
            tx["ml_model_type"] = model_type

            # IP enrichment
            ip_features = self.ip_correlator.get_wallet_features(
                tx["input_addresses"][0] if tx.get("input_addresses") else ""
            )
            tx["ip_anonymity_score"] = ip_features.get("anonymity_score", 0.0)
            tx["ip_geo_diversity"] = ip_features.get("geo_diversity", 0)

            self.processed_txs.append(tx)

            # Alert queue
            if risk_eval["risk_score"] >= 50:
                self.alert_queue.append({
                    "lead_id": f"LEAD_{tx['txid'][:10].upper()}",
                    "txid": tx["txid"],
                    "entity_id": entity_id,
                    "risk_score": risk_eval["risk_score"],
                    "risk_level": risk_eval["risk_level"],
                    "signals": risk_eval["signals"],
                    "explanation": risk_eval["explanation"],
                    "pattern": tx.get("pattern", "unknown"),
                    "propagated_risk": round(propagated_risk, 4),
                    "timestamp": tx.get("timestamp"),
                    "geo_country": tx.get("geo_country", "UNKNOWN"),
                })

            if (i + 1) % 500 == 0:
                logger.info(f"   Processed {i+1}/{len(transactions)} transactions...")

        # Sort alert queue by risk score
        self.alert_queue.sort(key=lambda x: x["risk_score"], reverse=True)

        # Phase 6: Automatic Investigation Trigger
        logger.info("Phase 6/6: Running automatic investigation engine...")
        self._run_auto_investigations(transactions)

        # Persist to MongoDB
        if self.db is not None:
            self._persist_results()

        elapsed = time.time() - start_time
        summary = self._build_summary(elapsed)
        logger.info(f"✅ Bulk ingestion complete in {elapsed:.1f}s")
        return summary

    def _run_auto_investigations(self, transactions: List[Dict[str, Any]]):
        """Phase 6: Automatically create and run investigations for high-risk entities."""
        trigger = InvestigationTrigger()
        investigated_entities = set()

        for tx in self.processed_txs:
            entity_id = tx.get("entity_id", "")
            if entity_id in investigated_entities:
                continue

            # Build risk output structure from enriched transaction
            risk_output = {
                "risk_score": tx.get("risk_score", 0),
                "signals": tx.get("signals", []),
                "components": tx.get("risk_components", {}),
                "propagated_risk": tx.get("propagated_risk", 0.0),
            }

            should_investigate, trigger_reasons = trigger.should_investigate(risk_output)
            if not should_investigate:
                continue

            investigated_entities.add(entity_id)

            try:
                engine = InvestigationEngine(
                    graph=self.graph,
                    entity_profiler=self.entity_profiler,
                    risk_engine=self.risk_engine,
                    utxo_manager=self.utxo_mgr,
                    processed_txs=self.processed_txs,
                )

                inv = engine.create_investigation(
                    seed_txid=tx.get("txid"),
                    seed_entity_id=entity_id,
                    risk_output=risk_output,
                    trigger_reasons=trigger_reasons,
                )
                inv = engine.run_investigation(inv)
                self.investigations.append(inv)

                logger.info(
                    f"   🔍 Auto-investigation {inv['investigation_id']}: "
                    f"{len(inv.get('discovered_entities', []))} entities, "
                    f"{len(inv.get('final_leads', []))} leads"
                )
            except Exception as e:
                logger.warning(f"   ⚠️ Investigation failed for entity {entity_id}: {e}")

        logger.info(f"   Created {len(self.investigations)} auto-investigations")

    def _persist_results(self):
        """Persist processed transactions, entities, and alerts to MongoDB."""
        logger.info("   Persisting to MongoDB...")
        from pymongo import UpdateOne

        # Destructive replacement is strictly opt-in via self.drop_existing
        if self.drop_existing:
            logger.info("   [drop_existing=True] Clearing existing bitcoin collections before write...")
            for coll_name in ["bitcoin_transactions", "bitcoin_entities", "bitcoin_risk_events",
                              "bitcoin_blocks", "bitcoin_ip_correlations", "bitcoin_investigations",
                              "bitcoin_clusters"]:
                self.db[coll_name].delete_many({})
        else:
            logger.info("   [drop_existing=False] Preserving existing data via safe upserts...")

        # Persist transactions
        if self.processed_txs:
            clean_txs = [{k: v for k, v in tx.items() if k != "_id"} for tx in self.processed_txs]
            if self.drop_existing:
                self.db["bitcoin_transactions"].insert_many(clean_txs)
            else:
                tx_ops = [
                    UpdateOne({"txid": tx["txid"]}, {"$set": tx}, upsert=True)
                    for tx in clean_txs
                ]
                self.db["bitcoin_transactions"].bulk_write(tx_ops, ordered=False)

        # Build and persist entity profiles with real accounting and cluster assignments
        entity_map = {}
        for tx in self.processed_txs:
            eid = tx.get("entity_id", "")
            if not eid:
                continue
            if eid not in entity_map:
                ip_profile = self.ip_correlator.get_entity_ip_profile(eid)
                e_addrs = list(set(self.entity_profiler.get_entity_addresses(eid)))
                entity_map[eid] = {
                    "entity_id": eid,
                    "primary_address": e_addrs[0] if e_addrs else "",
                    "addresses": e_addrs,
                    "tx_count": 0,
                    "total_received_btc": 0.0,
                    "total_sent_btc": 0.0,
                    "balance_btc": 0.0,
                    "risk_score": 0,
                    "risk_level": "LOW",
                    "cluster_id": tx.get("cluster_id"),
                    "geo_countries": ip_profile.get("geo_countries", []),
                    "unique_ips": ip_profile.get("unique_ips", 0),
                    "anonymity_score": ip_profile.get("anonymity_score", 0.0),
                    "cross_entity_links": ip_profile.get("cross_entity_link_count", 0),
                    "propagated_risk": self.risk_propagation.get_risk_score(eid),
                    "is_seed_illicit": eid in self.risk_propagation._seed_nodes,
                    "velocity_1h": 0.0,
                    "velocity_24h": 0.0,
                    "total_volume_btc": 0.0,
                    "avg_tx_value": 0.0,
                }
            entity_map[eid]["tx_count"] += 1
            if tx.get("cluster_id") is not None:
                entity_map[eid]["cluster_id"] = tx.get("cluster_id")
            entity_map[eid]["risk_score"] = max(entity_map[eid]["risk_score"], tx.get("risk_score", 0))
            entity_map[eid]["risk_level"] = get_risk_level(entity_map[eid]["risk_score"])

        # Accurate accounting derived from transaction UTXOs
        for eid, profile in entity_map.items():
            e_addrs = set(profile["addresses"])
            e_txs = [t for t in self.processed_txs if t.get("entity_id") == eid]
            rec = 0.0
            sent = 0.0
            for t in e_txs:
                for out in t.get("outputs", []):
                    if out.get("address") in e_addrs:
                        rec += float(out.get("value_btc", 0.0))
                for inp in t.get("inputs", []):
                    if inp.get("address") in e_addrs:
                        sent += float(inp.get("value_btc", 0.0))
            if rec == 0.0 and sent == 0.0:
                rec = sum(float(t.get("total_output_btc", 0.0)) for t in e_txs)
                sent = sum(float(t.get("total_input_btc", 0.0)) for t in e_txs)

            profile["total_received_btc"] = round(rec, 6)
            profile["total_sent_btc"] = round(sent, 6)
            profile["balance_btc"] = round(max(0.0, rec - sent), 6)
            profile["total_volume_btc"] = round(rec + sent, 6)
            profile["avg_tx_value"] = round((rec + sent) / max(1, len(e_txs)), 6)

            # Derive real velocity metrics from transaction timeline
            ts_list = sorted([t.get("timestamp") or 0 for t in e_txs])
            latest_ts = ts_list[-1] if ts_list else 0
            v1h = sum(1 for ts in ts_list if (latest_ts - ts) <= 3600)
            v24h = sum(1 for ts in ts_list if (latest_ts - ts) <= 86400)
            profile["velocity_1h"] = round(float(v1h), 2)
            profile["velocity_24h"] = round(float(v24h), 2)

        if entity_map:
            if self.drop_existing:
                self.db["bitcoin_entities"].insert_many(list(entity_map.values()))
            else:
                entity_ops = [
                    UpdateOne({"entity_id": eid}, {"$set": prof}, upsert=True)
                    for eid, prof in entity_map.items()
                ]
                self.db["bitcoin_entities"].bulk_write(entity_ops, ordered=False)

        # Aggregate real clusters from ingested entities and persist
        cluster_groups: Dict[int, List[Dict[str, Any]]] = {}
        for eid, profile in entity_map.items():
            cid = profile.get("cluster_id")
            if cid is not None and cid >= 0:
                if cid not in cluster_groups:
                    cluster_groups[cid] = []
                cluster_groups[cid].append(profile)

        cluster_docs = []
        cluster_meta = self.ml_inference.get_cluster_metadata()
        for cid, e_list in sorted(cluster_groups.items()):
            meta = cluster_meta.get(str(cid), {})
            vols = [e["total_received_btc"] for e in e_list]
            avg_vol = round(sum(vols) / len(vols), 4) if vols else 0.0
            outliers = sum(1 for e in e_list if e.get("risk_score", 0) >= 70)
            anomaly_pct = round((outliers / len(e_list)) * 100.0, 1) if e_list else 0.0
            
            cluster_name = f"Behavioral Cluster #{cid}"
            cluster_desc = meta.get("description", f"Community of {len(e_list)} entities sharing structural behavioral profiles.")

            cluster_docs.append({
                "cluster_id": cid,
                "name": cluster_name,
                "description": cluster_desc,
                "entity_count": len(e_list),
                "avg_volume_btc": avg_vol,
                "avg_velocity_1h": meta.get("avg_velocity", 1.0),
                "anomaly_rate_pct": anomaly_pct,
            })

        if cluster_docs:
            if self.drop_existing:
                self.db["bitcoin_clusters"].insert_many(cluster_docs)
            else:
                cluster_ops = [
                    UpdateOne({"cluster_id": c["cluster_id"]}, {"$set": c}, upsert=True)
                    for c in cluster_docs
                ]
                self.db["bitcoin_clusters"].bulk_write(cluster_ops, ordered=False)

        # Insert risk events (alerts)
        if self.alert_queue:
            if self.drop_existing:
                self.db["bitcoin_risk_events"].insert_many(self.alert_queue)
            else:
                alert_ops = [
                    UpdateOne({"txid": a["txid"]}, {"$set": a}, upsert=True)
                    for a in self.alert_queue
                ]
                self.db["bitcoin_risk_events"].bulk_write(alert_ops, ordered=False)

        # Insert geo/IP correlation stats
        geo_stats = self.ip_correlator.get_geo_stats()
        if geo_stats:
            if self.drop_existing:
                self.db["bitcoin_ip_correlations"].insert_many(geo_stats)
            else:
                geo_ops = [
                    UpdateOne({"country": g["country"]}, {"$set": g}, upsert=True)
                    for g in geo_stats if "country" in g
                ]
                if geo_ops:
                    self.db["bitcoin_ip_correlations"].bulk_write(geo_ops, ordered=False)

        # Insert block summary with real derived block height (or None if unconfirmed)
        heights = [tx["block_height"] for tx in self.processed_txs if tx.get("block_height") is not None]
        summary_height = max(heights) if heights else None
        self.db["bitcoin_blocks"].insert_one({
            "height": summary_height,
            "hash": f"bulk_ingest_batch_{int(time.time())}",
            "time": int(time.time()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "tx_count": len(self.processed_txs),
            "size": len(self.processed_txs) * 250,
            "status": "confirmed",
        })

        # Insert investigations
        if self.investigations:
            clean_invs = []
            for inv in self.investigations:
                clean = {k: v for k, v in inv.items() if k != "_id"}
                clean_invs.append(clean)
            if self.drop_existing:
                self.db["bitcoin_investigations"].insert_many(clean_invs)
            else:
                inv_ops = [
                    UpdateOne({"investigation_id": inv["investigation_id"]}, {"$set": inv}, upsert=True)
                    for inv in clean_invs
                ]
                self.db["bitcoin_investigations"].bulk_write(inv_ops, ordered=False)

        # Persist verified system telemetry (measured throughput & inference latency)
        elapsed_ingest = time.time() - getattr(self, "_ingest_start_time", time.time())
        batch_tps = round(len(self.processed_txs) / max(0.001, elapsed_ingest), 2)
        telemetry = self.ml_inference.get_telemetry()

        system_telemetry_doc = {
            "_id": "telemetry",
            "model": telemetry.get("model", {}),
            "inference": telemetry.get("inference", {}),
            "throughput": {
                "status": "idle",
                "tx_per_sec": 0.0,
                "last_batch_tps": batch_tps,
                "historical_avg_tps": batch_tps,
                "processed_transactions": len(self.processed_txs),
                "elapsed_seconds": round(elapsed_ingest, 2),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
        self.db["bitcoin_system_telemetry"].replace_one(
            {"_id": "telemetry"},
            system_telemetry_doc,
            upsert=True
        )

        logger.info(f"   Persisted {len(self.processed_txs)} txs, "
                     f"{len(entity_map)} entities, {len(self.alert_queue)} alerts, "
                     f"{len(self.investigations)} investigations, and system telemetry")

    def _build_summary(self, elapsed: float) -> Dict[str, Any]:
        """Build ingestion summary."""
        pattern_counts = {}
        for tx in self.processed_txs:
            p = tx.get("pattern", "unknown")
            pattern_counts[p] = pattern_counts.get(p, 0) + 1

        risk_distribution = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
        for tx in self.processed_txs:
            level = tx.get("risk_level", "LOW")
            risk_distribution[level] = risk_distribution.get(level, 0) + 1

        prop_summary = self.risk_propagation.get_propagation_summary()
        corr_summary = self.ip_correlator.get_correlation_summary()

        # Investigation summary
        inv_summary = []
        for inv in self.investigations:
            inv_summary.append({
                "investigation_id": inv.get("investigation_id"),
                "seed_entity_id": inv.get("seed_entity_id"),
                "status": inv.get("investigation_status"),
                "depth": inv.get("investigation_depth", 0),
                "discovered_entities": len(inv.get("discovered_entities", [])),
                "leads": len(inv.get("final_leads", [])),
            })

        return {
            "total_transactions": len(self.processed_txs),
            "total_alerts": len(self.alert_queue),
            "total_investigations": len(self.investigations),
            "elapsed_seconds": round(elapsed, 2),
            "pattern_distribution": pattern_counts,
            "risk_distribution": risk_distribution,
            "propagation_summary": prop_summary,
            "ip_correlation_summary": {
                "total_unique_ips": corr_summary["total_unique_ips"],
                "tor_ips": corr_summary["tor_ip_count"],
                "vpn_ips": corr_summary["vpn_ip_count"],
                "cross_entity_links": corr_summary["cross_entity_ip_links"],
            },
            "top_alerts": self.alert_queue[:10],
            "investigations": inv_summary,
        }

    def get_alert_queue(self) -> List[Dict[str, Any]]:
        """Get the ranked, explainable alert list."""
        return self.alert_queue

    def get_geo_stats(self) -> List[Dict[str, Any]]:
        """Get geographic distribution stats."""
        return self.ip_correlator.get_geo_stats()


# ---------------------------------------------------------------------------
# CLI Entry Point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="V.E.C.T.O.R Bitcoin Bulk Ingestion")
    parser.add_argument("--input", required=True, help="Input file path (CSV/JSON/XML)")
    parser.add_argument("--format", choices=["csv", "json", "xml"], default="csv", help="Input format")
    parser.add_argument("--no-persist", action="store_true", help="Skip MongoDB persistence")
    parser.add_argument("--drop-existing", action="store_true", help="Explicitly clear existing Bitcoin collections before persisting")
    args = parser.parse_args()

    # Parse input
    if args.format == "csv":
        transactions = parse_csv(args.input)
    elif args.format == "json":
        transactions = parse_json(args.input)
    elif args.format == "xml":
        transactions = parse_xml(args.input)
    else:
        raise ValueError(f"Unsupported format: {args.format}")

    # Run pipeline
    pipeline = BulkIngestPipeline(persist_to_mongo=not args.no_persist, drop_existing=args.drop_existing)
    summary = pipeline.ingest(transactions)

    # Print summary
    print("\n" + "=" * 60)
    print("V.E.C.T.O.R BULK INGESTION SUMMARY")
    print("=" * 60)
    print(json.dumps(summary, indent=2, default=str))

    # Print top alerts
    print("\n🚨 TOP INVESTIGATIVE LEADS:")
    print("-" * 60)
    for i, alert in enumerate(summary.get("top_alerts", [])[:10]):
        print(f"  {i+1}. [{alert['risk_level']}] Score: {alert['risk_score']:.1f} | "
              f"Pattern: {alert['pattern']} | Entity: {alert['entity_id'][:16]}")
        print(f"     {alert['explanation'][:120]}")
        print()


if __name__ == "__main__":
    main()
