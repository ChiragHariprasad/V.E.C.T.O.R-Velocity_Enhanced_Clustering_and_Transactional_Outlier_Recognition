"""
Bitcoin Block & Stream Processor
Core engine coordinating block ingestion, UTXO state transitions, graph updates,
feature extraction, V.E.C.T.O.R ML evaluation, and multi-model risk scoring.
"""

import os
import json
import joblib
import logging
import numpy as np
import redis
import pymongo
from typing import Dict, Any, List, Optional
from bitcoin.config import (
    REDIS_HOST, REDIS_PORT, REDIS_DB,
    STREAM_BITCOIN_BLOCKS, STREAM_BITCOIN_TXS, STREAM_BITCOIN_RISK,
    MONGO_URI, MONGO_DB_NAME,
    COLL_BLOCKS, COLL_TRANSACTIONS, COLL_UTXOS, COLL_ENTITIES, COLL_ADDRESSES, COLL_RISK_EVENTS,
    MODEL_DIR
)
from bitcoin.rpc_client import BitcoinRPCClient
from bitcoin.transaction_parser import BitcoinTransactionParser
from bitcoin.utxo_manager import UTXOManager
from bitcoin.entity_profiler import EntityProfiler
from bitcoin.transaction_graph import BitcoinTransactionGraph
from bitcoin.bitcoin_rules import BitcoinRulesEngine
from bitcoin.bitcoin_features import BitcoinFeatureEngine
from bitcoin.risk_engine import BitcoinRiskEngine
from bitcoin.schemas import BITCOIN_FEATURE_KEYS

logger = logging.getLogger("VECTOR.BitcoinProcessor")

class BitcoinBlockProcessor:
    def __init__(self, use_mock: bool = False):
        self.rpc = BitcoinRPCClient(force_mock=use_mock)
        self.utxo_mgr = UTXOManager()
        self.entity_profiler = EntityProfiler()
        self.graph = BitcoinTransactionGraph()
        self.risk_engine = BitcoinRiskEngine()
        
        # Redis client
        try:
            self.redis = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB, decode_responses=True)
            self.redis.ping()
        except Exception:
            self.redis = None

        # MongoDB client
        try:
            self.mongo = pymongo.MongoClient(MONGO_URI)
            self.db = self.mongo[MONGO_DB_NAME]
        except Exception:
            self.db = None

        # Load ML models
        from bitcoin.ml_inference import BitcoinMLInferenceEngine
        self.ml_inference = BitcoinMLInferenceEngine()
        self.models_loaded = self.ml_inference.is_operational
        self._entity_history: Dict[str, List[Dict[str, Any]]] = {}

    def process_block(self, block_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Process an entire Bitcoin block: parse transactions, update graph & UTXOs,
        extract behavioral features, run risk scoring, and persist outputs.
        """
        block_height = block_data.get("height")
        block_hash = block_data.get("hash", "")
        block_time = block_data.get("time")
        raw_txs = block_data.get("tx", [])

        processed_txs = []

        # Store block summary
        if self.db is not None:
            self.db[COLL_BLOCKS].update_one(
                {"hash": block_hash},
                {"$set": {
                    "height": block_height,
                    "hash": block_hash,
                    "time": block_time,
                    "tx_count": len(raw_txs),
                    "size": block_data.get("size", 1000000),
                    "status": "confirmed"
                }},
                upsert=True
            )

        for raw_tx in raw_txs:
            # 1. Parse transaction
            tx = BitcoinTransactionParser.parse_transaction(
                raw_tx,
                block_height=block_height,
                block_hash=block_hash,
                block_time=block_time,
                status="confirmed"
            )

            # 2. Derive entity from common inputs
            primary_addr = tx["input_addresses"][0] if tx["input_addresses"] else (tx["output_addresses"][0] if tx["output_addresses"] else "unknown")
            entity_id = self.entity_profiler.get_or_create_entity(tx["input_addresses"], primary_addr)
            tx["entity_id"] = entity_id
            entity_addrs = self.entity_profiler.get_entity_addresses(entity_id)

            # 3. Process UTXO lifecycle
            utxo_stats = self.utxo_mgr.process_transaction(tx)

            # 4. Ingest into transaction graph
            self.graph.add_transaction(tx, entity_id=entity_id)
            graph_stats = self.graph.get_node_features(entity_id)
            motif_stats = self.graph.detect_motifs(tx)

            # 5. Evaluate behavioral rules/heuristics
            rule_eval = BitcoinRulesEngine.evaluate_heuristics(tx, utxo_stats=utxo_stats)

            # 6. Extract behavioral features with actual entity history
            history = self._entity_history.get(entity_id, [])
            features = BitcoinFeatureEngine.compute_features(
                tx=tx,
                entity_id=entity_id,
                entity_history=history,
                utxo_stats=utxo_stats,
                graph_stats=graph_stats,
                motif_stats=motif_stats,
                entity_addresses=entity_addrs
            )

            if entity_id not in self._entity_history:
                self._entity_history[entity_id] = []
            self._entity_history[entity_id].append(tx)

            # 7. ML Model Anomaly Scoring via V.E.C.T.O.R Pipeline
            is_cold_start = (len(history) < 2)
            ml_result = self.ml_inference.predict(features, is_cold_start=is_cold_start)
            ml_score = ml_result.get("ml_score")
            model_type = ml_result.get("model_type", "ML_UNAVAILABLE")
            cluster_id = ml_result.get("cluster_id")

            # 8. Multi-Model Risk Engine
            risk_eval = self.risk_engine.evaluate_risk(
                ml_score=ml_score,
                model_type=model_type,
                features=features,
                rule_eval=rule_eval,
                graph_stats=graph_stats
            )

            tx["risk_score"] = risk_eval["risk_score"]
            tx["risk_level"] = risk_eval["risk_level"]
            tx["risk_components"] = risk_eval["components"]
            tx["signals"] = risk_eval["signals"]
            tx["explanation"] = risk_eval["explanation"]
            tx["cluster_id"] = cluster_id

            processed_txs.append(tx)

            # 9. Persistence to MongoDB
            if self.db is not None:
                self.db[COLL_TRANSACTIONS].update_one({"txid": tx["txid"]}, {"$set": tx}, upsert=True)
                
                # Update entity profile with real features
                self.db[COLL_ENTITIES].update_one(
                    {"entity_id": entity_id},
                    {"$set": {
                        "entity_id": entity_id,
                        "last_seen": tx["timestamp"],
                        "risk_score": tx["risk_score"],
                        "risk_level": tx["risk_level"],
                        "cluster_id": tx["cluster_id"],
                        "velocity_1h": round(float(features.get("tx_velocity_1h", 1.0)), 2),
                        "velocity_24h": round(float(features.get("tx_velocity_24h", 1.0)), 2),
                        "avg_tx_value": round(float(features.get("avg_tx_value", tx["total_output_btc"])), 6)
                    }, "$inc": {
                        "tx_count": 1,
                        "total_received_btc": tx["total_output_btc"],
                        "total_volume_btc": tx["total_output_btc"]
                    }},
                    upsert=True
                )

                # Record risk event if HIGH or CRITICAL
                if tx["risk_score"] >= 50:
                    self.db[COLL_RISK_EVENTS].insert_one({
                        "lead_id": f"LEAD_{tx['txid'][:10]}",
                        "txid": tx["txid"],
                        "entity_id": entity_id,
                        "risk_score": tx["risk_score"],
                        "risk_level": tx["risk_level"],
                        "signals": tx["signals"],
                        "explanation": tx["explanation"],
                        "timestamp": tx["timestamp"]
                    })

            # 10. Publish to Redis Stream
            if self.redis is not None:
                try:
                    self.redis.xadd(STREAM_BITCOIN_TXS, {"data": json.dumps({
                        "txid": tx["txid"],
                        "entity_id": entity_id,
                        "amount_btc": tx["total_output_btc"],
                        "risk_score": tx["risk_score"],
                        "risk_level": tx["risk_level"]
                    })})
                except Exception:
                    pass

        return processed_txs
