"""
Comprehensive V.E.C.T.O.R-BITCOIN Test Suite
Validates the entire end-to-end integration:
RPC Client -> Parser -> UTXO Engine -> Graph -> Features -> Rules -> Risk Engine.
"""

import unittest
from bitcoin.rpc_client import BitcoinRPCClient
from bitcoin.transaction_parser import BitcoinTransactionParser
from bitcoin.utxo_manager import UTXOManager
from bitcoin.entity_profiler import EntityProfiler
from bitcoin.transaction_graph import BitcoinTransactionGraph
from bitcoin.bitcoin_rules import BitcoinRulesEngine
from bitcoin.bitcoin_features import BitcoinFeatureEngine
from bitcoin.risk_engine import BitcoinRiskEngine
from bitcoin.schemas import BITCOIN_FEATURE_KEYS

class TestBitcoinPipeline(unittest.TestCase):
    def setUp(self):
        self.rpc = BitcoinRPCClient(force_mock=True)
        self.parser = BitcoinTransactionParser()
        self.utxo_mgr = UTXOManager()
        self.entity_profiler = EntityProfiler()
        self.graph = BitcoinTransactionGraph()
        self.risk_engine = BitcoinRiskEngine()

    def test_01_rpc_block_retrieval(self):
        """Test retrieving blocks from RPC client."""
        block = self.rpc.get_block("test_hash_001")
        self.assertIn("hash", block)
        self.assertIn("tx", block)
        self.assertGreater(len(block["tx"]), 0)

    def test_02_transaction_parsing(self):
        """Test parsing transaction UTXOs and scripts."""
        block = self.rpc.get_block("test_hash_001")
        raw_tx = block["tx"][0]
        parsed = self.parser.parse_transaction(raw_tx, block_height=840100)
        
        self.assertIn("txid", parsed)
        self.assertIn("inputs", parsed)
        self.assertIn("outputs", parsed)
        self.assertEqual(parsed["status"], "confirmed")
        self.assertGreaterEqual(parsed["total_output_btc"], 0.0)

    def test_03_utxo_lifecycle(self):
        """Test UTXO creation, spending and age calculations."""
        block = self.rpc.get_block("test_hash_001")
        raw_tx = block["tx"][0]
        parsed = self.parser.parse_transaction(raw_tx, block_height=840100)
        stats = self.utxo_mgr.process_transaction(parsed)

        self.assertIn("avg_utxo_age_blocks", stats)
        self.assertIn("young_utxo_spending_ratio", stats)
        self.assertIn("utxo_fragmentation", stats)

    def test_04_entity_clustering(self):
        """Test common-input heuristic entity grouping."""
        addr1 = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"
        addr2 = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
        entity_id = self.entity_profiler.get_or_create_entity([addr1, addr2], addr1)

        self.assertTrue(entity_id.startswith("ENT_"))
        self.assertEqual(self.entity_profiler.get_entity_for_address(addr1), entity_id)
        self.assertEqual(self.entity_profiler.get_entity_for_address(addr2), entity_id)

    def test_05_graph_analytics(self):
        """Test transaction graph creation, PageRank, and motif detection."""
        block = self.rpc.get_block("test_hash_001")
        for raw_tx in block["tx"]:
            parsed = self.parser.parse_transaction(raw_tx, block_height=840100)
            self.graph.add_transaction(parsed)

        self.graph.compute_centralities()
        sample_node = list(self.graph.graph.nodes())[0]
        features = self.graph.get_node_features(sample_node)

        self.assertIn("pagerank", features)
        self.assertIn("degree", features)
        self.assertIn("weighted_degree", features)

    def test_06_feature_engineering_vector(self):
        """Test generating the complete 50+ canonical feature vector."""
        block = self.rpc.get_block("test_hash_001")
        parsed = self.parser.parse_transaction(block["tx"][0], block_height=840100)
        utxo_stats = self.utxo_mgr.process_transaction(parsed)
        graph_stats = self.graph.get_node_features(parsed["txid"])
        motif_stats = self.graph.detect_motifs(parsed)

        features = BitcoinFeatureEngine.compute_features(
            tx=parsed,
            entity_id="ENT_TEST_001",
            entity_history=[],
            utxo_stats=utxo_stats,
            graph_stats=graph_stats,
            motif_stats=motif_stats
        )

        for key in BITCOIN_FEATURE_KEYS:
            self.assertIn(key, features)

        vec = BitcoinFeatureEngine.feature_dict_to_array(features)
        self.assertEqual(len(vec), len(BITCOIN_FEATURE_KEYS))

    def test_07_multi_model_risk_scoring(self):
        """Test risk score synthesis and natural-language explanation generation."""
        block = self.rpc.get_block("test_hash_001")
        parsed = self.parser.parse_transaction(block["tx"][0], block_height=840100)
        utxo_stats = self.utxo_mgr.process_transaction(parsed)
        graph_stats = self.graph.get_node_features(parsed["txid"])
        motif_stats = self.graph.detect_motifs(parsed)
        rule_eval = BitcoinRulesEngine.evaluate_heuristics(parsed, utxo_stats=utxo_stats)

        features = BitcoinFeatureEngine.compute_features(
            tx=parsed,
            entity_id="ENT_TEST_001",
            entity_history=[],
            utxo_stats=utxo_stats,
            graph_stats=graph_stats,
            motif_stats=motif_stats
        )

        risk_eval = self.risk_engine.evaluate_risk(
            ml_score=0.88,
            model_type="isolation_forest",
            features=features,
            rule_eval=rule_eval,
            graph_stats=graph_stats
        )

        self.assertIn("risk_score", risk_eval)
        self.assertIn("risk_level", risk_eval)
        self.assertIn("components", risk_eval)
        self.assertIn("explanation", risk_eval)
        self.assertGreaterEqual(risk_eval["risk_score"], 0)
        self.assertLessEqual(risk_eval["risk_score"], 100)

if __name__ == "__main__":
    unittest.main()
