"""
V.E.C.T.O.R — Wallet Intelligence & Search Correctness Test Suite
================================================================
Validates:
1. Search Entity Detection:
   - Supports real bulk-ingested entity IDs (ENT_XXXXXXXXXXXX)
   - Supports Bitcoin addresses
   - Supports TXIDs (64 hex characters)
   - Supports Investigation IDs (INV-...)
   - Rejects/returns empty for unknown entities and unknown TXIDs
2. Wallet Analysis Execution:
   - POST /api/bitcoin/wallets/:addr/analyze executes full V.E.C.T.O.R analysis
   - Returns real persisted velocities (velocity_1h, velocity_24h) and volumes (total_volume_btc, avg_tx_value)
   - Resolves entity across address, entity ID, and transaction mappings
   - Returns full required schemas: entity, behavior, cluster, risk, transactions, graph, patterns, investigation, leads
3. Input/Output Integrity & Anti-Leakage:
   - Records and mirrors exact query_input in analysis response
   - Clean cold-start behavior for unrecorded valid addresses (is_known: false)
   - Strict HTTP 400 validation for malformed address identifiers
   - Sequential calls with different inputs exhibit zero cross-query leakage
"""

import unittest
import urllib.request
import urllib.error
import json
import time

API_BASE = "http://localhost:3001/api/bitcoin"

class TestWalletSearchAndIntelligence(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Verify server is up before testing
        req = urllib.request.Request(f"{API_BASE}/status")
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                assert response.status == 200
        except Exception as e:
            raise RuntimeError(f"Node server is not reachable at {API_BASE}/status: {e}")

    # =========================================================================
    # 1. ENTITY SEARCH VALIDATION
    # =========================================================================

    def test_search_bulk_ingested_entity_id(self):
        """Test searching for real bulk-ingested entity format ENT_XXXXXXXXXXXX."""
        entity_id = "ENT_22E730C8B03C"
        req = urllib.request.Request(f"{API_BASE}/search?q={entity_id}")
        with urllib.request.urlopen(req, timeout=5) as response:
            self.assertEqual(response.status, 200)
            data = json.loads(response.read().decode('utf-8'))
            
            # Must return at least the entity match
            entity_matches = [m for m in data if m.get("type") == "entity" and m.get("id") == entity_id]
            self.assertTrue(len(entity_matches) >= 1, f"Expected entity match for {entity_id} in results: {data}")
            match = entity_matches[0]
            self.assertEqual(match["id"], entity_id)
            self.assertEqual(match["query_matched"], entity_id)
            self.assertIn("Cluster", match.get("subLabel", ""))

    def test_search_unknown_entity_id(self):
        """Test searching for a non-existent entity ID returns no entity match."""
        unknown_id = "ENT_FFFFFFFFFFFF"
        req = urllib.request.Request(f"{API_BASE}/search?q={unknown_id}")
        with urllib.request.urlopen(req, timeout=5) as response:
            self.assertEqual(response.status, 200)
            data = json.loads(response.read().decode('utf-8'))
            entity_matches = [m for m in data if m.get("type") == "entity" and m.get("id") == unknown_id]
            self.assertEqual(len(entity_matches), 0, f"Unknown entity {unknown_id} must not produce entity match")

    def test_search_txid(self):
        """Test searching for a real TXID from ingested dataset."""
        # Query known tx from database
        txid = "5abda24f43eb72cda6d65b2169afa1558fd3785ff8c69ad6ed11dd6163152d04"
        req = urllib.request.Request(f"{API_BASE}/search?q={txid}")
        with urllib.request.urlopen(req, timeout=5) as response:
            self.assertEqual(response.status, 200)
            data = json.loads(response.read().decode('utf-8'))
            tx_matches = [m for m in data if m.get("type") == "transaction" and m.get("id") == txid]
            self.assertTrue(len(tx_matches) >= 1, f"Expected transaction match for {txid}")
            self.assertEqual(tx_matches[0]["query_matched"], txid)

    def test_search_unknown_txid(self):
        """Test searching for an unrecorded TXID returns empty."""
        fake_txid = "0000000000000000000000000000000000000000000000000000000000000000"
        req = urllib.request.Request(f"{API_BASE}/search?q={fake_txid}")
        with urllib.request.urlopen(req, timeout=5) as response:
            self.assertEqual(response.status, 200)
            data = json.loads(response.read().decode('utf-8'))
            self.assertEqual(len(data), 0, f"Unrecorded TXID should yield 0 results, got: {data}")

    def test_search_investigation_id(self):
        """Test searching for an investigation ID prefix or full ID."""
        req = urllib.request.Request(f"{API_BASE}/search?q=INV-")
        with urllib.request.urlopen(req, timeout=5) as response:
            self.assertEqual(response.status, 200)
            data = json.loads(response.read().decode('utf-8'))
            inv_matches = [m for m in data if m.get("type") == "investigation"]
            self.assertTrue(len(inv_matches) >= 1, "Expected investigation matches for 'INV-'")

    # =========================================================================
    # 2. WALLET ANALYSIS WORKFLOW & METRICS INTEGRITY
    # =========================================================================

    def test_analyze_wallet_post_method(self):
        """Test POST /api/bitcoin/wallets/:addr/analyze executes correctly and returns all schemas."""
        entity_id = "ENT_22E730C8B03C"
        req = urllib.request.Request(
            f"{API_BASE}/wallets/{entity_id}/analyze",
            data=b"{}",
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            self.assertEqual(response.status, 200)
            analysis = json.loads(response.read().decode('utf-8'))

            # Check input/output tracking
            self.assertEqual(analysis.get("query_input"), entity_id)
            self.assertTrue(analysis.get("is_known"))
            self.assertEqual(analysis.get("resolved_entity_id"), entity_id)

            # Check entity block
            entity = analysis.get("entity", {})
            self.assertEqual(entity.get("entity_id"), entity_id)
            self.assertGreaterEqual(entity.get("address_count", 0), 1)

            # Check real non-zero velocity and volume metrics
            behavior = analysis.get("behavior", {})
            self.assertGreater(behavior.get("velocity_1h", 0), 0, "velocity_1h must not be zero for active entity")
            self.assertGreater(behavior.get("velocity_24h", 0), 0, "velocity_24h must not be zero for active entity")
            self.assertGreater(behavior.get("total_volume_btc", 0), 0, "total_volume_btc must not be zero")
            self.assertGreater(behavior.get("avg_tx_value", 0), 0, "avg_tx_value must not be zero")
            self.assertGreater(behavior.get("counterparty_diversity", 0), 0)

            # Check cluster block
            cluster = analysis.get("cluster", {})
            self.assertIn("cluster_id", cluster)
            self.assertIn("archetype", cluster)

            # Check risk block
            risk = analysis.get("risk", {})
            self.assertGreater(risk.get("score", 0), 0)
            self.assertIn(risk.get("level"), ["LOW", "MEDIUM", "HIGH", "CRITICAL"])
            self.assertIn("components", risk)
            self.assertIn("ml_anomaly", risk["components"])
            self.assertIn("graph_risk", risk["components"])
            self.assertIn("velocity_signal", risk["components"])

            # Check graph context
            graph = analysis.get("graph", {})
            self.assertIn("nodes", graph)
            self.assertIn("edges", graph)
            self.assertGreater(len(graph["nodes"]), 0)

            # Check patterns
            patterns = analysis.get("patterns", [])
            self.assertIsInstance(patterns, list)

            # Check leads & investigation state
            self.assertIn("investigation", analysis)
            self.assertIn("leads", analysis)
            self.assertIsInstance(analysis["leads"], list)
            self.assertIn("analyzed_at", analysis)

    def test_analyze_cold_start_valid_address(self):
        """Test POST /api/bitcoin/wallets/:addr/analyze with an unrecorded valid Bitcoin address."""
        cold_addr = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
        req = urllib.request.Request(
            f"{API_BASE}/wallets/{cold_addr}/analyze",
            data=b"{}",
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            self.assertEqual(response.status, 200)
            analysis = json.loads(response.read().decode('utf-8'))

            self.assertEqual(analysis.get("query_input"), cold_addr)
            self.assertFalse(analysis.get("is_known"), "Unrecorded address must have is_known=False")
            self.assertEqual(analysis.get("risk", {}).get("score"), 0)
            self.assertEqual(analysis.get("risk", {}).get("level"), "LOW")
            self.assertEqual(len(analysis.get("transactions", [])), 0)

    def test_analyze_invalid_address_format(self):
        """Test POST /api/bitcoin/wallets/:addr/analyze with malformed input rejects with HTTP 400."""
        invalid_id = "not_a_valid_bitcoin_address_or_entity!"
        req = urllib.request.Request(
            f"{API_BASE}/wallets/{invalid_id}/analyze",
            data=b"{}",
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        try:
            urllib.request.urlopen(req, timeout=5)
            self.fail("Expected HTTP 400 for invalid address format")
        except urllib.error.HTTPError as e:
            self.assertEqual(e.code, 400)
            err_body = json.loads(e.read().decode('utf-8'))
            self.assertEqual(err_body.get("status"), "INVALID_FORMAT")

    def test_no_previous_result_leakage(self):
        """Verify sequential queries do not leak previous results into subsequent responses."""
        target_a = "ENT_22E730C8B03C"
        target_b = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"

        # Query A
        req_a = urllib.request.Request(f"{API_BASE}/wallets/{target_a}/analyze", data=b"{}", headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req_a, timeout=5) as res_a:
            data_a = json.loads(res_a.read().decode('utf-8'))

        # Query B
        req_b = urllib.request.Request(f"{API_BASE}/wallets/{target_b}/analyze", data=b"{}", headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req_b, timeout=5) as res_b:
            data_b = json.loads(res_b.read().decode('utf-8'))

        self.assertEqual(data_a["query_input"], target_a)
        self.assertEqual(data_b["query_input"], target_b)
        self.assertTrue(data_a["is_known"])
        self.assertFalse(data_b["is_known"])
        self.assertNotEqual(data_a["risk"]["score"], data_b["risk"]["score"])


if __name__ == '__main__':
    unittest.main()
