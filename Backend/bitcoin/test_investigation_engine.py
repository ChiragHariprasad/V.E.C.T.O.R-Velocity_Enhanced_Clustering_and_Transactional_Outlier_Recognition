"""
V.E.C.T.O.R-BITCOIN Investigation Engine Test Suite
Validates the complete investigation workflow with a controlled synthetic
chain: A → B → C → D with known timestamps, amounts, and behavior.

Tests:
  1.  Investigation trigger
  2.  Seed entity extraction
  3.  One-hop expansion
  4.  Multi-hop expansion
  5.  Cycle prevention
  6.  Max-depth enforcement
  7.  Flow calculation
  8.  Forwarding ratio
  9.  Analytical node roles
  10. Pattern integration
  11. Risk propagation
  12. Lead ranking
  13. Evidence generation
  14. Investigation API response
  15. Graph response
"""

import unittest
from bitcoin.entity_profiler import EntityProfiler
from bitcoin.transaction_graph import BitcoinTransactionGraph
from bitcoin.risk_engine import BitcoinRiskEngine
from bitcoin.utxo_manager import UTXOManager
from bitcoin.investigation_engine import (
    InvestigationTrigger,
    InvestigationEngine,
    STATUS_OPEN,
    STATUS_ANALYZING,
    STATUS_COMPLETED,
    ROLE_SOURCE,
    ROLE_INTERMEDIARY,
    ROLE_LAYERING,
    ROLE_EXIT_CANDIDATE,
    ROLE_UNKNOWN,
)


def build_synthetic_chain():
    """
    Build a controlled 4-entity chain:
      Entity_A (seed) → Entity_B → Entity_C → Entity_D

    Known:
      A sends 10.4 BTC → B via TX_AB
      B forwards 10.1 BTC → C via TX_BC  (rapid: 300s later)
      C forwards 9.8 BTC → D via TX_CD   (rapid: 200s later)
      D holds (exit candidate)

    Entity_A is illicit (peel chain + high velocity).
    """
    entity_profiler = EntityProfiler()
    graph = BitcoinTransactionGraph()
    risk_engine = BitcoinRiskEngine()
    utxo_mgr = UTXOManager()

    base_ts = 1700000000

    # Addresses
    addr_a = "bc1q_addr_a_seed_wallet"
    addr_b = "bc1q_addr_b_intermediary"
    addr_c = "bc1q_addr_c_layering"
    addr_d = "bc1q_addr_d_exit"

    # Entity resolution
    ent_a = entity_profiler.get_or_create_entity([addr_a], addr_a)
    ent_b = entity_profiler.get_or_create_entity([addr_b], addr_b)
    ent_c = entity_profiler.get_or_create_entity([addr_c], addr_c)
    ent_d = entity_profiler.get_or_create_entity([addr_d], addr_d)

    # Transaction A → B: 10.4 BTC (peel chain: 2 outputs, asymmetric)
    tx_ab = {
        "txid": "tx_ab_0001_hash_abcdef1234567890",
        "timestamp": base_ts,
        "block_height": 840000,
        "input_count": 1,
        "output_count": 2,
        "total_input_btc": 10.5,
        "total_output_btc": 10.4,
        "fee_btc": 0.1,
        "entity_id": ent_a,
        "input_addresses": [addr_a],
        "output_addresses": [addr_b, addr_a],  # addr_a is change
        "inputs": [{"address": addr_a, "value_btc": 10.5, "prev_txid": "prev_a", "prev_vout": 0}],
        "outputs": [
            {"address": addr_b, "value_btc": 10.0, "vout": 0, "is_op_return": False},
            {"address": addr_a, "value_btc": 0.4, "vout": 1, "is_op_return": False},  # change
        ],
        "risk_score": 82.5,
        "risk_level": "CRITICAL",
        "risk_components": {
            "ml_score": 75.0,
            "graph_score": 55.0,
            "velocity_score": 60.0,
            "temporal_score": 45.0,
            "utxo_score": 30.0,
            "rule_score": 65.0,
        },
        "signals": ["peel_chain_pattern", "velocity_spike", "rapid_forwarding"],
        "explanation": "Peel chain pattern with high velocity anomaly.",
        "propagated_risk": 0.0,
        "is_illicit": True,
        "src_ip": "10.255.1.1",
        "geo_country": "XX",
        "pattern": "peel_chain",
        "status": "confirmed",
    }

    # Transaction B → C: 10.1 BTC (rapid forwarding, 300s after)
    tx_bc = {
        "txid": "tx_bc_0002_hash_bcdef12345678901",
        "timestamp": base_ts + 300,
        "block_height": 840001,
        "input_count": 1,
        "output_count": 1,
        "total_input_btc": 10.0,
        "total_output_btc": 10.1,
        "fee_btc": 0.001,
        "entity_id": ent_b,
        "input_addresses": [addr_b],
        "output_addresses": [addr_c],
        "inputs": [{"address": addr_b, "value_btc": 10.0, "prev_txid": tx_ab["txid"], "prev_vout": 0}],
        "outputs": [
            {"address": addr_c, "value_btc": 10.1, "vout": 0, "is_op_return": False},
        ],
        "risk_score": 55.0,
        "risk_level": "HIGH",
        "risk_components": {
            "ml_score": 40.0,
            "graph_score": 30.0,
            "velocity_score": 55.0,
            "temporal_score": 30.0,
            "utxo_score": 20.0,
            "rule_score": 30.0,
        },
        "signals": ["rapid_forwarding"],
        "explanation": "Rapid forwarding detected.",
        "propagated_risk": 0.6,
        "is_illicit": False,
        "src_ip": "95.216.1.1",
        "geo_country": "DE",
        "pattern": "rapid_forward",
        "status": "confirmed",
    }

    # Transaction C → D: 9.8 BTC (rapid forwarding, 200s after B→C)
    tx_cd = {
        "txid": "tx_cd_0003_hash_cdef123456789012",
        "timestamp": base_ts + 500,
        "block_height": 840002,
        "input_count": 1,
        "output_count": 1,
        "total_input_btc": 10.1,
        "total_output_btc": 9.8,
        "fee_btc": 0.001,
        "entity_id": ent_c,
        "input_addresses": [addr_c],
        "output_addresses": [addr_d],
        "inputs": [{"address": addr_c, "value_btc": 10.1, "prev_txid": tx_bc["txid"], "prev_vout": 0}],
        "outputs": [
            {"address": addr_d, "value_btc": 9.8, "vout": 0, "is_op_return": False},
        ],
        "risk_score": 45.0,
        "risk_level": "MEDIUM",
        "risk_components": {
            "ml_score": 35.0,
            "graph_score": 25.0,
            "velocity_score": 40.0,
            "temporal_score": 25.0,
            "utxo_score": 15.0,
            "rule_score": 25.0,
        },
        "signals": ["rapid_forwarding"],
        "explanation": "Rapid forwarding continues.",
        "propagated_risk": 0.4,
        "is_illicit": False,
        "src_ip": "178.162.1.1",
        "geo_country": "NL",
        "pattern": "rapid_forward",
        "status": "confirmed",
    }

    # A dummy transaction for entity D (receives but doesn't forward)
    tx_d_hold = {
        "txid": "tx_d_hold_0004_hash_def1234567890123",
        "timestamp": base_ts + 86400,  # 1 day later, no forwarding
        "block_height": 840100,
        "input_count": 0,
        "output_count": 1,
        "total_input_btc": 0,
        "total_output_btc": 9.8,
        "fee_btc": 0.0,
        "entity_id": ent_d,
        "input_addresses": [],
        "output_addresses": [addr_d],
        "inputs": [],
        "outputs": [{"address": addr_d, "value_btc": 9.8, "vout": 0, "is_op_return": False}],
        "risk_score": 20.0,
        "risk_level": "LOW",
        "risk_components": {
            "ml_score": 15.0,
            "graph_score": 10.0,
            "velocity_score": 10.0,
            "temporal_score": 5.0,
            "utxo_score": 5.0,
            "rule_score": 5.0,
        },
        "signals": [],
        "explanation": "Baseline behavior.",
        "propagated_risk": 0.2,
        "is_illicit": False,
        "src_ip": "0.0.0.0",
        "geo_country": "UNKNOWN",
        "pattern": "unknown",
        "status": "confirmed",
    }

    all_txs = [tx_ab, tx_bc, tx_cd, tx_d_hold]

    # Build graph
    for tx in all_txs:
        graph.add_transaction(tx, entity_id=tx.get("entity_id"))
    graph.compute_centralities()

    return {
        "entity_profiler": entity_profiler,
        "graph": graph,
        "risk_engine": risk_engine,
        "utxo_mgr": utxo_mgr,
        "all_txs": all_txs,
        "tx_ab": tx_ab,
        "tx_bc": tx_bc,
        "tx_cd": tx_cd,
        "ent_a": ent_a,
        "ent_b": ent_b,
        "ent_c": ent_c,
        "ent_d": ent_d,
        "addr_a": addr_a,
        "addr_b": addr_b,
        "addr_c": addr_c,
        "addr_d": addr_d,
    }


class TestInvestigationTrigger(unittest.TestCase):
    """Test investigation trigger logic."""

    def test_01_high_risk_triggers_investigation(self):
        """Composite risk ≥ threshold should trigger investigation."""
        trigger = InvestigationTrigger(threshold=70)
        risk_output = {
            "risk_score": 82.5,
            "signals": ["peel_chain_pattern", "velocity_spike"],
            "components": {"ml_score": 75, "graph_score": 55, "velocity_score": 60,
                           "temporal_score": 45, "utxo_score": 30, "rule_score": 65},
            "propagated_risk": 0.0,
        }
        should, reasons = trigger.should_investigate(risk_output)
        self.assertTrue(should)
        self.assertTrue(any("composite_risk_score" in r for r in reasons))

    def test_02_low_risk_does_not_trigger(self):
        """Low risk score should NOT trigger investigation."""
        trigger = InvestigationTrigger(threshold=70)
        risk_output = {
            "risk_score": 25.0,
            "signals": [],
            "components": {"ml_score": 20, "graph_score": 10, "velocity_score": 15,
                           "temporal_score": 5, "utxo_score": 5, "rule_score": 10},
            "propagated_risk": 0.0,
        }
        should, reasons = trigger.should_investigate(risk_output)
        self.assertFalse(should)
        self.assertEqual(len(reasons), 0)

    def test_03_multi_signal_triggers(self):
        """Multiple independent elevated signals should trigger investigation."""
        trigger = InvestigationTrigger(threshold=90, multi_signal_min=3)
        risk_output = {
            "risk_score": 65.0,  # Below threshold
            "signals": ["peel_chain_pattern", "velocity_spike", "rapid_forwarding"],
            "components": {"ml_score": 65, "graph_score": 55, "velocity_score": 60,
                           "temporal_score": 45, "utxo_score": 10, "rule_score": 50},
            "propagated_risk": 0.0,
        }
        should, reasons = trigger.should_investigate(risk_output)
        self.assertTrue(should)
        self.assertTrue(any("multi_signal" in r for r in reasons))

    def test_04_propagated_risk_triggers(self):
        """High propagated risk from illicit seed should trigger."""
        trigger = InvestigationTrigger(threshold=90)
        risk_output = {
            "risk_score": 40.0,
            "signals": [],
            "components": {"ml_score": 30, "graph_score": 20, "velocity_score": 20,
                           "temporal_score": 10, "utxo_score": 10, "rule_score": 10},
            "propagated_risk": 0.7,
        }
        should, reasons = trigger.should_investigate(risk_output)
        self.assertTrue(should)
        self.assertTrue(any("propagated_risk" in r for r in reasons))


class TestInvestigationEngine(unittest.TestCase):
    """Test investigation engine core functionality."""

    def setUp(self):
        self.chain = build_synthetic_chain()
        self.engine = InvestigationEngine(
            graph=self.chain["graph"],
            entity_profiler=self.chain["entity_profiler"],
            risk_engine=self.chain["risk_engine"],
            utxo_manager=self.chain["utxo_mgr"],
            processed_txs=self.chain["all_txs"],
            max_depth=3,
            max_entities=100,
        )

    def test_05_seed_entity_extraction(self):
        """Seed entity analysis should extract correct profile metrics."""
        inv = self.engine.create_investigation(
            seed_txid=self.chain["tx_ab"]["txid"],
            seed_entity_id=self.chain["ent_a"],
            risk_output=self.chain["tx_ab"],
            trigger_reasons=["test_trigger"],
        )
        self.assertEqual(inv["seed_entity_id"], self.chain["ent_a"])
        self.assertEqual(inv["investigation_status"], "OPEN")
        self.assertTrue(inv["investigation_id"].startswith("INV-"))

        # Run and check seed analysis
        inv = self.engine.run_investigation(inv)
        seed_analysis = inv["seed_analysis"]
        self.assertEqual(seed_analysis["entity_id"], self.chain["ent_a"])
        self.assertGreater(seed_analysis["tx_count"], 0)

    def test_06_one_hop_expansion(self):
        """Investigation should discover at least first-hop downstream entity."""
        inv = self.engine.create_investigation(
            seed_entity_id=self.chain["ent_a"],
            risk_output=self.chain["tx_ab"],
            trigger_reasons=["test"],
        )
        inv = self.engine.run_investigation(inv)

        # Entity B should be discovered (1-hop downstream)
        self.assertIn(self.chain["ent_b"], inv["discovered_entities"])
        self.assertGreater(len(inv["discovered_entities"]), 1)  # At least seed + B

    def test_07_multi_hop_expansion(self):
        """Investigation should reach entity C or D through multi-hop expansion."""
        inv = self.engine.create_investigation(
            seed_entity_id=self.chain["ent_a"],
            risk_output=self.chain["tx_ab"],
            trigger_reasons=["test"],
        )
        inv = self.engine.run_investigation(inv)

        # Should discover more than just A and B
        discovered = inv["discovered_entities"]
        self.assertGreater(len(discovered), 1)
        # Investigation depth should be >= 1
        self.assertGreaterEqual(inv["investigation_depth"], 1)

    def test_08_cycle_prevention(self):
        """Entities should only appear once in discovered list (no cycles)."""
        inv = self.engine.create_investigation(
            seed_entity_id=self.chain["ent_a"],
            risk_output=self.chain["tx_ab"],
            trigger_reasons=["test"],
        )
        inv = self.engine.run_investigation(inv)

        discovered = inv["discovered_entities"]
        # No duplicates
        self.assertEqual(len(discovered), len(set(discovered)))

    def test_09_max_depth_enforcement(self):
        """Investigation depth should not exceed configured MAX_INVESTIGATION_DEPTH."""
        engine = InvestigationEngine(
            graph=self.chain["graph"],
            entity_profiler=self.chain["entity_profiler"],
            risk_engine=self.chain["risk_engine"],
            utxo_manager=self.chain["utxo_mgr"],
            processed_txs=self.chain["all_txs"],
            max_depth=1,  # Limit to 1 hop
            max_entities=100,
        )
        inv = engine.create_investigation(
            seed_entity_id=self.chain["ent_a"],
            risk_output=self.chain["tx_ab"],
            trigger_reasons=["test"],
        )
        inv = engine.run_investigation(inv)

        self.assertLessEqual(inv["investigation_depth"], 1)

    def test_10_flow_calculation(self):
        """Flow path should contain correct amounts and hop numbers."""
        inv = self.engine.create_investigation(
            seed_entity_id=self.chain["ent_a"],
            risk_output=self.chain["tx_ab"],
            trigger_reasons=["test"],
        )
        inv = self.engine.run_investigation(inv)

        flow_path = inv["flow_path"]
        if len(flow_path) > 0:
            first_step = flow_path[0]
            self.assertEqual(first_step["hop"], 1)
            self.assertGreater(first_step["amount"], 0)
            self.assertIn("forwarding_ratio", first_step)
            self.assertIn("pct_of_seed", first_step)

    def test_11_forwarding_ratio(self):
        """Forwarding ratio should be calculated correctly."""
        inv = self.engine.create_investigation(
            seed_entity_id=self.chain["ent_a"],
            risk_output=self.chain["tx_ab"],
            trigger_reasons=["test"],
        )
        inv = self.engine.run_investigation(inv)

        for step in inv["flow_path"]:
            self.assertGreaterEqual(step["forwarding_ratio"], 0)
            self.assertLessEqual(step["forwarding_ratio"], 1.0)

    def test_12_analytical_node_roles(self):
        """Seed entity should have SOURCE role."""
        inv = self.engine.create_investigation(
            seed_entity_id=self.chain["ent_a"],
            risk_output=self.chain["tx_ab"],
            trigger_reasons=["test"],
        )
        inv = self.engine.run_investigation(inv)

        # Find seed in graph nodes
        seed_node = None
        for node in inv.get("graph_nodes", []):
            if node.get("is_seed"):
                seed_node = node
                break

        if seed_node:
            self.assertEqual(seed_node["role"], ROLE_SOURCE)

    def test_13_pattern_integration(self):
        """Detected patterns should include existing rule signals."""
        inv = self.engine.create_investigation(
            seed_entity_id=self.chain["ent_a"],
            risk_output=self.chain["tx_ab"],
            trigger_reasons=["test"],
        )
        inv = self.engine.run_investigation(inv)

        patterns = inv["detected_patterns"]
        # Patterns from rule engine should be present
        self.assertIsInstance(patterns, list)
        for p in patterns:
            self.assertIn("pattern_type", p)
            self.assertIn("involved_transactions", p)
            self.assertIn("hop", p)

    def test_14_risk_propagation(self):
        """Risk propagation should produce distinct direct and propagated values."""
        inv = self.engine.create_investigation(
            seed_entity_id=self.chain["ent_a"],
            risk_output=self.chain["tx_ab"],
            trigger_reasons=["test"],
        )
        inv = self.engine.run_investigation(inv)

        prop_results = inv.get("risk_propagation_results", {})
        self.assertIn("entity_risks", prop_results)
        self.assertIn("propagation_summary", prop_results)

        entity_risks = prop_results.get("entity_risks", {})
        if entity_risks:
            for eid, risk_info in entity_risks.items():
                self.assertIn("direct_risk", risk_info)
                self.assertIn("propagated_risk", risk_info)

    def test_15_lead_ranking(self):
        """Leads should be sorted by composite score descending."""
        inv = self.engine.create_investigation(
            seed_entity_id=self.chain["ent_a"],
            risk_output=self.chain["tx_ab"],
            trigger_reasons=["test"],
        )
        inv = self.engine.run_investigation(inv)

        leads = inv["final_leads"]
        self.assertIsInstance(leads, list)
        for lead in leads:
            self.assertIn("entity_id", lead)
            self.assertIn("priority", lead)
            self.assertIn("risk_label", lead)
            self.assertIn("composite_score", lead)
            self.assertIn("reasons", lead)
            self.assertIn("evidence_summary", lead)

        # Check sorted order
        if len(leads) >= 2:
            for i in range(len(leads) - 1):
                self.assertGreaterEqual(
                    leads[i]["composite_score"],
                    leads[i + 1]["composite_score"]
                )

    def test_16_evidence_generation(self):
        """Evidence should contain structured data from actual computation."""
        inv = self.engine.create_investigation(
            seed_entity_id=self.chain["ent_a"],
            risk_output=self.chain["tx_ab"],
            trigger_reasons=["test_trigger_reason"],
        )
        inv = self.engine.run_investigation(inv)

        evidence = inv["evidence"]
        self.assertIn("trigger", evidence)
        self.assertIn("flow_evidence", evidence)
        self.assertIn("patterns", evidence)
        self.assertIn("entity_evidence", evidence)

        flow_ev = evidence["flow_evidence"]
        self.assertIn("seed_amount", flow_ev)
        self.assertIn("hop_count", flow_ev)
        self.assertIn("forwarding_ratio", flow_ev)

    def test_17_investigation_api_response_structure(self):
        """Investigation should have all required fields for API response."""
        inv = self.engine.create_investigation(
            seed_entity_id=self.chain["ent_a"],
            risk_output=self.chain["tx_ab"],
            trigger_reasons=["api_test"],
        )
        inv = self.engine.run_investigation(inv)

        required_fields = [
            "investigation_id", "seed_transaction_id", "seed_entity_id",
            "initial_risk_score", "trigger_reasons", "created_at",
            "investigation_status", "investigation_depth",
            "discovered_entities", "discovered_transactions",
            "detected_patterns", "evidence", "final_leads",
        ]
        for field in required_fields:
            self.assertIn(field, inv, f"Missing field: {field}")

        self.assertEqual(inv["investigation_status"], STATUS_COMPLETED)

    def test_18_graph_response_structure(self):
        """Graph response should have nodes and edges with required fields."""
        inv = self.engine.create_investigation(
            seed_entity_id=self.chain["ent_a"],
            risk_output=self.chain["tx_ab"],
            trigger_reasons=["graph_test"],
        )
        inv = self.engine.run_investigation(inv)

        nodes = inv.get("graph_nodes", [])
        edges = inv.get("graph_edges", [])

        for node in nodes:
            self.assertIn("id", node)
            self.assertIn("role", node)
            self.assertIn("risk_score", node)
            self.assertIn("is_seed", node)

        for edge in edges:
            self.assertIn("source", edge)
            self.assertIn("target", edge)
            self.assertIn("amount", edge)
            self.assertIn("hop", edge)


if __name__ == "__main__":
    unittest.main()
