"""
V.E.C.T.O.R — Analytical Core Correctness Test Suite
Validates:
1. Feature Calculation: Real periodicity, counterparty concentration (HHI),
   repeated counterparty ratio, counterparty deviation, and temporal deviation.
2. Total Sent & Balance: Mathematical conservation without hardcoded 0.95 multipliers.
3. Block Height: Integrity without fabricated 840000 fallback.
4. Model Inference: Feature validation, UMAP, HDBSCAN clustering, and cluster Isolation Forest.
5. ML Fallback & Availability: Graceful routing to XGBoost fallback and explicit ML_UNAVAILABLE handling.
6. Risk Engine Integration: Dynamic weight redistribution when ML is unavailable.
"""

import unittest
import numpy as np
from typing import Dict, Any

from bitcoin.bitcoin_features import BitcoinFeatureEngine
from bitcoin.ml_inference import BitcoinMLInferenceEngine, ML_UNAVAILABLE
from bitcoin.risk_engine import BitcoinRiskEngine
from bitcoin.utxo_manager import UTXOManager
from bitcoin.schemas import BITCOIN_FEATURE_KEYS


class TestAnalyticalCoreCorrectness(unittest.TestCase):

    def setUp(self):
        self.ml_engine = BitcoinMLInferenceEngine()
        self.risk_engine = BitcoinRiskEngine()
        self.utxo_mgr = UTXOManager()

    # -------------------------------------------------------------------------
    # 1. Feature Calculation Tests
    # -------------------------------------------------------------------------

    def test_01_activity_periodicity_regular_vs_erratic(self):
        """
        Verify activity_periodicity:
        - Regular intervals (e.g. exactly 600s) have CV = 0 -> periodicity = 1.0
        - Erratic/bursty intervals have CV >> 1 -> low periodicity
        - Single transaction -> 0.0
        """
        # Case A: Perfectly regular bot/settlement schedule (every 600 seconds)
        entity_history_regular = [
            {"timestamp": 1700000000 + i * 600, "total_output_btc": 0.5, "input_addresses": ["addr_me"], "output_addresses": ["addr_peer"]}
            for i in range(5)
        ]
        curr_tx_regular = {
            "timestamp": 1700000000 + 5 * 600,
            "total_output_btc": 0.5,
            "input_addresses": ["addr_me"],
            "output_addresses": ["addr_peer"]
        }
        feat_regular = BitcoinFeatureEngine.compute_features(
            tx=curr_tx_regular,
            entity_id="ENT_REGULAR",
            entity_history=entity_history_regular,
            utxo_stats={},
            graph_stats={},
            motif_stats={},
            entity_addresses=["addr_me"]
        )
        # Perfectly periodic should be 1.0 (BEFORE it was fixed to 0.5)
        self.assertAlmostEqual(feat_regular["activity_periodicity"], 1.0, places=2)

        # Case B: Erratic intervals: [10s, 72000s, 5s, 144000s]
        entity_history_erratic = [
            {"timestamp": 1700000000, "total_output_btc": 0.5, "input_addresses": ["addr_me"], "output_addresses": ["addr_peer"]},
            {"timestamp": 1700000010, "total_output_btc": 0.5, "input_addresses": ["addr_me"], "output_addresses": ["addr_peer"]},
            {"timestamp": 1700072010, "total_output_btc": 0.5, "input_addresses": ["addr_me"], "output_addresses": ["addr_peer"]},
            {"timestamp": 1700072015, "total_output_btc": 0.5, "input_addresses": ["addr_me"], "output_addresses": ["addr_peer"]},
        ]
        curr_tx_erratic = {
            "timestamp": 1700216015,
            "total_output_btc": 0.5,
            "input_addresses": ["addr_me"],
            "output_addresses": ["addr_peer"]
        }
        feat_erratic = BitcoinFeatureEngine.compute_features(
            tx=curr_tx_erratic,
            entity_id="ENT_ERRATIC",
            entity_history=entity_history_erratic,
            utxo_stats={},
            graph_stats={},
            motif_stats={},
            entity_addresses=["addr_me"]
        )
        self.assertLess(feat_erratic["activity_periodicity"], 0.5)

        # Case C: Single transaction (no intervals)
        feat_single = BitcoinFeatureEngine.compute_features(
            tx=curr_tx_regular,
            entity_id="ENT_SINGLE",
            entity_history=[],
            utxo_stats={},
            graph_stats={},
            motif_stats={},
            entity_addresses=["addr_me"]
        )
        self.assertEqual(feat_single["activity_periodicity"], 0.0)

    def test_02_counterparty_concentration_hhi(self):
        """
        Verify counterparty_concentration:
        - 1 single peer -> HHI = 1.0 (100% concentration)
        - 4 peers equally interacted with -> HHI = 0.25
        (BEFORE it was fixed to 0.45)
        """
        # Case A: 100% concentrated to single counterparty
        history_monopolist = [
            {"timestamp": 1700000000 + i * 100, "total_output_btc": 1.0, "input_addresses": ["addr_me"], "output_addresses": ["addr_sole_partner"]}
            for i in range(4)
        ]
        curr_tx_mono = {
            "timestamp": 1700000500,
            "total_output_btc": 1.0,
            "input_addresses": ["addr_me"],
            "output_addresses": ["addr_sole_partner"]
        }
        feat_mono = BitcoinFeatureEngine.compute_features(
            tx=curr_tx_mono,
            entity_id="ENT_MONO",
            entity_history=history_monopolist,
            utxo_stats={},
            graph_stats={},
            motif_stats={},
            entity_addresses=["addr_me"]
        )
        self.assertAlmostEqual(feat_mono["counterparty_concentration"], 1.0, places=3)

        # Case B: Distributed across 4 distinct peers equally (1 each)
        history_diversified = [
            {"timestamp": 1700000000 + i * 100, "total_output_btc": 1.0, "input_addresses": ["addr_me"], "output_addresses": [f"peer_{i}"]}
            for i in range(3)
        ]
        curr_tx_div = {
            "timestamp": 1700000400,
            "total_output_btc": 1.0,
            "input_addresses": ["addr_me"],
            "output_addresses": ["peer_3"]
        }
        feat_div = BitcoinFeatureEngine.compute_features(
            tx=curr_tx_div,
            entity_id="ENT_DIV",
            entity_history=history_diversified,
            utxo_stats={},
            graph_stats={},
            motif_stats={},
            entity_addresses=["addr_me"]
        )
        # 4 peers with share 0.25 each -> sum(0.25^2) = 4 * 0.0625 = 0.25
        self.assertAlmostEqual(feat_div["counterparty_concentration"], 0.25, places=3)

    def test_03_repeated_counterparty_ratio(self):
        """
        Verify repeated_counterparty_ratio:
        - All fresh single-use peers -> 0.0
        - All peers repeated -> 1.0
        (BEFORE it was fixed to 0.2)
        """
        # Case A: 3 distinct peers, each seen once
        history_fresh = [
            {"timestamp": 1700000000 + i * 100, "total_output_btc": 1.0, "input_addresses": ["addr_me"], "output_addresses": [f"peer_fresh_{i}"]}
            for i in range(2)
        ]
        curr_tx_fresh = {
            "timestamp": 1700000300,
            "total_output_btc": 1.0,
            "input_addresses": ["addr_me"],
            "output_addresses": ["peer_fresh_2"]
        }
        feat_fresh = BitcoinFeatureEngine.compute_features(
            tx=curr_tx_fresh,
            entity_id="ENT_FRESH",
            entity_history=history_fresh,
            utxo_stats={},
            graph_stats={},
            motif_stats={},
            entity_addresses=["addr_me"]
        )
        self.assertEqual(feat_fresh["repeated_counterparty_ratio"], 0.0)

        # Case B: 2 peers, both seen twice
        history_repeated = [
            {"timestamp": 1700000000, "total_output_btc": 1.0, "input_addresses": ["addr_me"], "output_addresses": ["peer_A"]},
            {"timestamp": 1700000100, "total_output_btc": 1.0, "input_addresses": ["addr_me"], "output_addresses": ["peer_B"]},
            {"timestamp": 1700000200, "total_output_btc": 1.0, "input_addresses": ["addr_me"], "output_addresses": ["peer_A"]},
        ]
        curr_tx_rep = {
            "timestamp": 1700000300,
            "total_output_btc": 1.0,
            "input_addresses": ["addr_me"],
            "output_addresses": ["peer_B"]
        }
        feat_rep = BitcoinFeatureEngine.compute_features(
            tx=curr_tx_rep,
            entity_id="ENT_REP",
            entity_history=history_repeated,
            utxo_stats={},
            graph_stats={},
            motif_stats={},
            entity_addresses=["addr_me"]
        )
        # Both peer_A and peer_B have count 2 > 1 -> 2/2 = 1.0
        self.assertEqual(feat_rep["repeated_counterparty_ratio"], 1.0)

    def test_04_counterparty_and_temporal_deviation(self):
        """
        Verify counterparty_deviation and temporal_deviation:
        - Baseline conformity -> 0.0 deviation
        - Sudden spike -> positive deviation
        (BEFORE both were static 0.15 and 0.20)
        """
        history = [
            {"timestamp": 1700000000 + i * 3600, "total_output_btc": 1.0, "input_addresses": ["addr_me"], "output_addresses": ["peer_1"]}
            for i in range(5)
        ]
        # Conforming tx: 1 peer, exactly 3600s after last
        tx_conforming = {
            "timestamp": 1700000000 + 5 * 3600,
            "total_output_btc": 1.0,
            "input_addresses": ["addr_me"],
            "output_addresses": ["peer_1"]
        }
        feat_conf = BitcoinFeatureEngine.compute_features(
            tx=tx_conforming,
            entity_id="ENT_CONF",
            entity_history=history,
            utxo_stats={},
            graph_stats={},
            motif_stats={},
            entity_addresses=["addr_me"]
        )
        self.assertAlmostEqual(feat_conf["counterparty_deviation"], 0.0, places=2)
        self.assertAlmostEqual(feat_conf["temporal_deviation"], 0.0, places=2)

        # Spiking tx: 10 peers, arriving after only 5 seconds (burst after 4th tx at 3*3600)
        tx_spiking = {
            "timestamp": 1700000000 + 3 * 3600 + 5,
            "total_output_btc": 1.0,
            "input_addresses": ["addr_me"],
            "output_addresses": [f"peer_spike_{i}" for i in range(10)]
        }
        feat_spike = BitcoinFeatureEngine.compute_features(
            tx=tx_spiking,
            entity_id="ENT_SPIKE",
            entity_history=history[:4],
            utxo_stats={},
            graph_stats={},
            motif_stats={},
            entity_addresses=["addr_me"]
        )
        self.assertGreater(feat_spike["counterparty_deviation"], 5.0)
        self.assertGreater(feat_spike["temporal_deviation"], 0.8)

    # -------------------------------------------------------------------------
    # 2. Total Sent & Balance Accounting Tests
    # -------------------------------------------------------------------------

    def test_05_total_sent_and_received_accuracy(self):
        """
        Verify total_sent_btc and total_received_btc:
        - Must NOT be total_received * 0.95
        - Must accurately compute from inputs/outputs
        """
        # Entity receives 10.0 BTC in tx1, spends 4.0 BTC in tx2
        tx1 = {
            "txid": "tx1",
            "timestamp": 1700000000,
            "inputs": [{"address": "external_funder", "value_btc": 10.0}],
            "outputs": [{"address": "my_wallet", "value_btc": 10.0}],
            "total_output_btc": 10.0,
            "total_input_btc": 10.0,
            "input_addresses": ["external_funder"],
            "output_addresses": ["my_wallet"]
        }
        tx2 = {
            "txid": "tx2",
            "timestamp": 1700001000,
            "inputs": [{"address": "my_wallet", "value_btc": 10.0}],
            "outputs": [
                {"address": "merchant_dest", "value_btc": 4.0},
                {"address": "my_wallet", "value_btc": 5.999}  # change
            ],
            "total_output_btc": 9.999,
            "total_input_btc": 10.0,
            "input_addresses": ["my_wallet"],
            "output_addresses": ["merchant_dest", "my_wallet"]
        }

        feat = BitcoinFeatureEngine.compute_features(
            tx=tx2,
            entity_id="ENT_WALLET",
            entity_history=[tx1],
            utxo_stats={},
            graph_stats={},
            motif_stats={},
            entity_addresses=["my_wallet"]
        )

        # Expected:
        # Received: 10.0 (initial) + 5.999 (change) = 15.999 BTC
        # Sent: 10.0 (spent inputs from my_wallet) = 10.0 BTC
        self.assertEqual(feat["total_received_btc"], 15.999)
        self.assertEqual(feat["total_sent_btc"], 10.0)
        # Crucial check: NOT 15.999 * 0.95 = 15.19905
        self.assertNotAlmostEqual(feat["total_sent_btc"], 15.999 * 0.95, places=2)

    # -------------------------------------------------------------------------
    # 3. Block Height Handling Tests
    # -------------------------------------------------------------------------

    def test_06_block_height_none_when_absent(self):
        """
        Verify that missing block height results in None, never fabricating 840000.
        """
        from bitcoin.bulk_ingest import _normalize_row
        row_without_height = {
            "txid": "tx_no_height",
            "timestamp": "2026-09-17 12:00:00",
            "input_addresses": "addr_in",
            "output_addresses": "addr_out",
            "input_amounts": "1.0",
            "output_amounts": "0.999",
            "fee": "0.001"
        }
        normalized = _normalize_row(row_without_height)
        self.assertIsNone(normalized["block_height"])
        self.assertNotEqual(normalized["block_height"], 840000)

        # UTXO Manager handles None block height cleanly
        stats = self.utxo_mgr.process_transaction(normalized)
        self.assertEqual(stats["avg_utxo_age_blocks"], 0.0)

    # -------------------------------------------------------------------------
    # 4. ML Model Inference & Fallback Tests
    # -------------------------------------------------------------------------

    def test_07_ml_inference_produces_real_scores(self):
        """
        Verify that BitcoinMLInferenceEngine produces genuine ML anomaly scores
        (not the fixed 0.15 heuristic) within [0.0, 1.0].
        """
        self.assertTrue(self.ml_engine.is_operational)
        sample_features = {k: 0.0 for k in BITCOIN_FEATURE_KEYS}
        sample_features["tx_count"] = 150.0
        sample_features["avg_tx_value"] = 2.5
        sample_features["tx_velocity_1h"] = 45.0
        sample_features["unique_counterparties"] = 80.0

        res = self.ml_engine.predict(sample_features, is_cold_start=False)
        self.assertEqual(res["status"], "SUCCESS")
        self.assertIsNotNone(res["ml_score"])
        self.assertGreaterEqual(res["ml_score"], 0.0)
        self.assertLessEqual(res["ml_score"], 1.0)
        self.assertIn("cluster_id", res)
        self.assertNotEqual(res["model_type"], "bulk_ingest_heuristic")

    def test_08_ml_cold_start_fallback_to_xgboost(self):
        """
        Verify that cold-start entities (1-2 txs) route to xgboost_cold_start.
        """
        sample_features = {k: 0.0 for k in BITCOIN_FEATURE_KEYS}
        sample_features["tx_count"] = 1.0
        res = self.ml_engine.predict(sample_features, is_cold_start=True)
        self.assertEqual(res["status"], "SUCCESS")
        self.assertEqual(res["model_type"], "xgboost_cold_start")
        self.assertIsInstance(res["ml_score"], float)

    def test_09_ml_unavailable_explicit_handling(self):
        """
        Verify that when models are unavailable, engine returns ML_UNAVAILABLE
        and risk engine recalculates risk without fabricating 0.15.
        """
        uninit_engine = BitcoinMLInferenceEngine(model_dir="/non_existent_dir_404")
        self.assertFalse(uninit_engine.is_operational)

        sample_features = {k: 0.0 for k in BITCOIN_FEATURE_KEYS}
        res = uninit_engine.predict(sample_features)
        self.assertEqual(res["status"], ML_UNAVAILABLE)
        self.assertIsNone(res["ml_score"])
        self.assertEqual(res["model_type"], ML_UNAVAILABLE)

        # Risk engine handles ML_UNAVAILABLE cleanly
        risk_eval = self.risk_engine.evaluate_risk(
            ml_score=res["ml_score"],
            model_type=res["model_type"],
            features=sample_features,
            rule_eval={"rule_score": 30.0, "signals": ["test_signal"]},
            graph_stats={"pagerank": 0.001, "degree": 5.0}
        )
        self.assertIsNone(risk_eval["components"]["ml_score"])
        self.assertIn("ml_unavailable", risk_eval["signals"])
        self.assertGreater(risk_eval["risk_score"], 0.0)


if __name__ == "__main__":
    unittest.main()
