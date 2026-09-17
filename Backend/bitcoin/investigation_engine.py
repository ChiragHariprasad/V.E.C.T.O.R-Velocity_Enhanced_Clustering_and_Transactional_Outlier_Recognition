"""
V.E.C.T.O.R-BITCOIN Investigation Engine
Extends the existing detection pipeline with automatic investigation,
follow-the-money graph crawl, flow analysis, analytical role assignment,
pattern integration, risk propagation, lead ranking, and evidence generation.

Pipeline Extension:
  DETECT → INVESTIGATE → TRACE → PRIORITIZE → EXPLAIN
"""

import logging
import time
import hashlib
from typing import Dict, Any, List, Optional, Set, Tuple
from collections import deque

from bitcoin.config import (
    INVESTIGATION_THRESHOLD,
    MAX_INVESTIGATION_DEPTH,
    MAX_INVESTIGATION_ENTITIES,
    INVESTIGATION_FLOW_SIGNIFICANCE,
    INVESTIGATION_RAPID_FORWARD_SEC,
    INVESTIGATION_MULTI_SIGNAL_MIN,
)
from bitcoin.entity_profiler import EntityProfiler
from bitcoin.transaction_graph import BitcoinTransactionGraph
from bitcoin.bitcoin_features import BitcoinFeatureEngine
from bitcoin.bitcoin_rules import BitcoinRulesEngine
from bitcoin.risk_engine import BitcoinRiskEngine
from bitcoin.risk_propagation import RiskPropagationEngine
from bitcoin.utxo_manager import UTXOManager

logger = logging.getLogger("VECTOR.InvestigationEngine")


# =============================================================================
# Investigation Status Constants
# =============================================================================

STATUS_OPEN = "OPEN"
STATUS_ANALYZING = "ANALYZING"
STATUS_COMPLETED = "COMPLETED"
STATUS_REVIEWED = "REVIEWED"

# Analytical node roles
ROLE_SOURCE = "SOURCE"
ROLE_INTERMEDIARY = "INTERMEDIARY"
ROLE_CONSOLIDATION = "CONSOLIDATION"
ROLE_LAYERING = "LAYERING"
ROLE_DISPERSAL = "DISPERSAL"
ROLE_CONVERGENCE = "CONVERGENCE"
ROLE_EXIT_CANDIDATE = "EXIT_CANDIDATE"
ROLE_UNKNOWN = "UNKNOWN"


# =============================================================================
# Investigation Trigger
# =============================================================================

class InvestigationTrigger:
    """
    Decides whether a transaction/entity warrants an automatic investigation
    by consuming existing risk engine output. Does NOT create its own scoring.
    """

    def __init__(
        self,
        threshold: float = INVESTIGATION_THRESHOLD,
        multi_signal_min: int = INVESTIGATION_MULTI_SIGNAL_MIN,
    ):
        self.threshold = threshold
        self.multi_signal_min = multi_signal_min

    def should_investigate(self, risk_output: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """
        Evaluate whether existing risk output warrants investigation.

        Args:
            risk_output: Output from BitcoinRiskEngine.evaluate_risk() enriched
                         with propagated_risk and signals from bulk_ingest.

        Returns:
            (should_investigate, trigger_reasons)
        """
        trigger_reasons = []
        risk_score = risk_output.get("risk_score", 0.0)
        signals = risk_output.get("signals", [])
        components = risk_output.get("components", {})
        propagated_risk = risk_output.get("propagated_risk", 0.0)

        # Criterion 1: Composite risk score exceeds threshold
        if risk_score >= self.threshold:
            trigger_reasons.append(
                f"composite_risk_score_elevated ({risk_score:.1f} >= {self.threshold})"
            )

        # Criterion 2: Multiple independent risk signals strongly elevated
        elevated_signals = []
        if components.get("ml_score", 0) >= 60:
            elevated_signals.append("high_ml_anomaly")
        if components.get("graph_score", 0) >= 50:
            elevated_signals.append("elevated_graph_centrality")
        if components.get("velocity_score", 0) >= 50:
            elevated_signals.append("velocity_deviation")
        if components.get("temporal_score", 0) >= 40:
            elevated_signals.append("temporal_anomaly")
        if components.get("utxo_score", 0) >= 40:
            elevated_signals.append("utxo_behavior_anomaly")
        if components.get("rule_score", 0) >= 40:
            elevated_signals.append("heuristic_pattern_match")

        if len(elevated_signals) >= self.multi_signal_min:
            trigger_reasons.append(
                f"multi_signal_elevation ({len(elevated_signals)} independent signals: "
                f"{', '.join(elevated_signals)})"
            )

        # Criterion 3: Significant propagated risk from illicit seed
        if propagated_risk >= 0.5:
            trigger_reasons.append(
                f"high_propagated_risk ({propagated_risk:.2f} from illicit seed)"
            )

        # Criterion 4: Specific high-severity pattern combinations
        pattern_signals = set(signals)
        severe_patterns = pattern_signals & {
            "peel_chain_pattern", "coinjoin_structure", "mixing_detected",
            "rapid_forwarding", "dormant_utxo_awakening", "tor_exit_node",
        }
        if len(severe_patterns) >= 2:
            trigger_reasons.append(
                f"severe_pattern_combination ({', '.join(severe_patterns)})"
            )

        return len(trigger_reasons) > 0, trigger_reasons


# =============================================================================
# Investigation Engine
# =============================================================================

class InvestigationEngine:
    """
    Orchestrates the full investigation lifecycle:
      1. Seed analysis
      2. Adaptive graph crawl (follow-the-money)
      3. Flow analysis
      4. Analytical role assignment
      5. Pattern integration
      6. Risk propagation
      7. Lead ranking
      8. Evidence generation
    """

    def __init__(
        self,
        graph: BitcoinTransactionGraph,
        entity_profiler: EntityProfiler,
        risk_engine: BitcoinRiskEngine,
        utxo_manager: UTXOManager,
        processed_txs: List[Dict[str, Any]],
        max_depth: int = MAX_INVESTIGATION_DEPTH,
        max_entities: int = MAX_INVESTIGATION_ENTITIES,
        flow_significance: float = INVESTIGATION_FLOW_SIGNIFICANCE,
        rapid_forward_sec: int = INVESTIGATION_RAPID_FORWARD_SEC,
    ):
        self.graph = graph
        self.entity_profiler = entity_profiler
        self.risk_engine = risk_engine
        self.utxo_manager = utxo_manager
        self.processed_txs = processed_txs
        self.max_depth = max_depth
        self.max_entities = max_entities
        self.flow_significance = flow_significance
        self.rapid_forward_sec = rapid_forward_sec

        # Build lookup indexes for processed transactions
        self._tx_by_id: Dict[str, Dict[str, Any]] = {}
        self._txs_by_entity: Dict[str, List[Dict[str, Any]]] = {}
        self._txs_by_input_addr: Dict[str, List[Dict[str, Any]]] = {}
        self._txs_by_output_addr: Dict[str, List[Dict[str, Any]]] = {}

        for tx in processed_txs:
            txid = tx.get("txid", "")
            if txid:
                self._tx_by_id[txid] = tx
            eid = tx.get("entity_id", "")
            if eid:
                self._txs_by_entity.setdefault(eid, []).append(tx)
            for addr in tx.get("input_addresses", []):
                self._txs_by_input_addr.setdefault(addr, []).append(tx)
            for addr in tx.get("output_addresses", []):
                self._txs_by_output_addr.setdefault(addr, []).append(tx)

    def create_investigation(
        self,
        seed_txid: Optional[str] = None,
        seed_entity_id: Optional[str] = None,
        risk_output: Optional[Dict[str, Any]] = None,
        trigger_reasons: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Create an investigation record from a suspicious seed."""
        inv_id = f"INV-{hashlib.sha256(f'{seed_txid or seed_entity_id}_{int(time.time())}'.encode()).hexdigest()[:10].upper()}"

        # Resolve entity from txid if needed
        if seed_txid and not seed_entity_id:
            tx = self._tx_by_id.get(seed_txid, {})
            seed_entity_id = tx.get("entity_id", "")

        investigation = {
            "investigation_id": inv_id,
            "seed_transaction_id": seed_txid or "",
            "seed_entity_id": seed_entity_id or "",
            "initial_risk_score": risk_output.get("risk_score", 0) if risk_output else 0,
            "trigger_reasons": trigger_reasons or [],
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "investigation_status": STATUS_OPEN,
            "investigation_depth": 0,
            "discovered_entities": [],
            "discovered_transactions": [],
            "detected_patterns": [],
            "evidence": {},
            "final_leads": [],
            "seed_analysis": {},
            "flow_path": [],
            "graph_nodes": [],
            "graph_edges": [],
            "risk_propagation_results": {},
        }

        logger.info(f"📋 Investigation {inv_id} created for entity {seed_entity_id}")
        return investigation

    def run_investigation(self, investigation: Dict[str, Any]) -> Dict[str, Any]:
        """Execute all investigation phases on a created investigation."""
        investigation["investigation_status"] = STATUS_ANALYZING
        seed_entity = investigation["seed_entity_id"]
        seed_txid = investigation["seed_transaction_id"]

        logger.info(f"🔍 Running investigation {investigation['investigation_id']} "
                     f"from seed entity {seed_entity}")

        # Phase 1: Seed entity analysis
        try:
            seed_analysis = self._analyze_seed_entity(seed_entity, seed_txid)
            investigation["seed_analysis"] = seed_analysis
        except Exception as e:
            logger.warning(f"Seed analysis partial failure: {e}")
            investigation["seed_analysis"] = {"error": str(e)}

        # Phase 2: Adaptive graph crawl (follow-the-money)
        try:
            crawl_result = self._follow_the_money(
                seed_entity,
                seed_amount=seed_analysis.get("total_outflow", 0.0),
            )
            investigation["discovered_entities"] = crawl_result["discovered_entities"]
            investigation["discovered_transactions"] = crawl_result["discovered_transactions"]
            investigation["investigation_depth"] = crawl_result["max_depth_reached"]
            investigation["flow_path"] = crawl_result["flow_path"]
        except Exception as e:
            logger.warning(f"Graph crawl partial failure: {e}")

        # Phase 3: Flow analysis (already computed in crawl)
        # flow_path is populated by _follow_the_money

        # Phase 4: Analytical role assignment
        try:
            node_roles = self._assign_roles(
                seed_entity,
                investigation["discovered_entities"],
                investigation["flow_path"],
            )
        except Exception as e:
            logger.warning(f"Role assignment partial failure: {e}")
            node_roles = {}

        # Phase 5: Pattern integration
        try:
            patterns = self._integrate_patterns(
                investigation["discovered_transactions"],
                investigation["flow_path"],
            )
            investigation["detected_patterns"] = patterns
        except Exception as e:
            logger.warning(f"Pattern integration partial failure: {e}")

        # Phase 6: Risk propagation (investigation-scoped)
        try:
            prop_results = self._propagate_risk(
                seed_entity,
                investigation["discovered_transactions"],
            )
            investigation["risk_propagation_results"] = prop_results
        except Exception as e:
            logger.warning(f"Risk propagation partial failure: {e}")

        # Phase 7: Build investigation graph response
        try:
            graph_data = self._build_investigation_graph(
                seed_entity,
                investigation["discovered_entities"],
                investigation["discovered_transactions"],
                investigation["flow_path"],
                node_roles,
                investigation.get("risk_propagation_results", {}),
            )
            investigation["graph_nodes"] = graph_data["nodes"]
            investigation["graph_edges"] = graph_data["edges"]
        except Exception as e:
            logger.warning(f"Graph build partial failure: {e}")

        # Phase 8: Lead ranking
        try:
            leads = self._rank_leads(
                seed_entity,
                investigation["discovered_entities"],
                node_roles,
                investigation.get("risk_propagation_results", {}),
                investigation["flow_path"],
                investigation["detected_patterns"],
            )
            investigation["final_leads"] = leads
        except Exception as e:
            logger.warning(f"Lead ranking partial failure: {e}")

        # Phase 9: Evidence generation
        try:
            evidence = self._generate_evidence(investigation)
            investigation["evidence"] = evidence
        except Exception as e:
            logger.warning(f"Evidence generation partial failure: {e}")

        investigation["investigation_status"] = STATUS_COMPLETED
        logger.info(
            f"✅ Investigation {investigation['investigation_id']} completed: "
            f"{len(investigation['discovered_entities'])} entities, "
            f"{len(investigation['discovered_transactions'])} txs, "
            f"{len(investigation['final_leads'])} leads"
        )
        return investigation

    # =========================================================================
    # Phase 1: Seed Entity Analysis
    # =========================================================================

    def _analyze_seed_entity(
        self, entity_id: str, seed_txid: str = ""
    ) -> Dict[str, Any]:
        """Build a profile of the seed entity using existing pipeline modules."""
        entity_txs = self._txs_by_entity.get(entity_id, [])
        addresses = self.entity_profiler.get_entity_addresses(entity_id)

        # Aggregate basic stats from entity transactions
        total_inflow = 0.0
        total_outflow = 0.0
        amounts = []
        timestamps = []
        counterparties: Set[str] = set()
        incoming_count = 0
        outgoing_count = 0

        for tx in entity_txs:
            amt = tx.get("total_output_btc", 0.0)
            amounts.append(amt)
            ts = tx.get("timestamp", 0)
            if ts:
                timestamps.append(ts)

            inp_addrs = set(tx.get("input_addresses", []))
            out_addrs = set(tx.get("output_addresses", []))
            entity_addrs = set(addresses)

            if inp_addrs & entity_addrs:
                total_outflow += amt
                outgoing_count += 1
                counterparties.update(out_addrs - entity_addrs)
            if out_addrs & entity_addrs:
                total_inflow += amt
                incoming_count += 1
                counterparties.update(inp_addrs - entity_addrs)

        tx_count = len(entity_txs)
        avg_value = sum(amounts) / max(1, len(amounts))

        # Velocity
        if len(timestamps) >= 2:
            ts_sorted = sorted(timestamps)
            span_hours = max(1, (ts_sorted[-1] - ts_sorted[0]) / 3600.0)
            tx_velocity = tx_count / span_hours
        else:
            tx_velocity = 0.0

        # Forwarding ratio
        forwarding_ratio = total_outflow / max(0.0001, total_inflow)

        # Graph features (reuse existing)
        graph_features = self.graph.get_node_features(entity_id)
        # Also try address-level features
        for addr in addresses[:3]:
            addr_features = self.graph.get_node_features(addr)
            if addr_features.get("degree", 0) > graph_features.get("degree", 0):
                graph_features = addr_features

        # Get existing risk score from most recent transaction
        existing_risk = 0.0
        anomaly_score = 0.0
        cluster_id = None
        for tx in entity_txs:
            if tx.get("risk_score", 0) > existing_risk:
                existing_risk = tx["risk_score"]
            if tx.get("risk_components", {}).get("ml_score", 0) > anomaly_score:
                anomaly_score = tx["risk_components"]["ml_score"]

        return {
            "entity_id": entity_id,
            "addresses": addresses,
            "tx_count": tx_count,
            "incoming_tx_count": incoming_count,
            "outgoing_tx_count": outgoing_count,
            "total_inflow": round(total_inflow, 6),
            "total_outflow": round(total_outflow, 6),
            "avg_tx_value": round(avg_value, 6),
            "tx_velocity": round(tx_velocity, 4),
            "counterparty_count": len(counterparties),
            "forwarding_ratio": round(min(1.0, forwarding_ratio), 4),
            "graph_centrality": graph_features,
            "anomaly_score": round(anomaly_score, 2),
            "existing_risk_score": round(existing_risk, 2),
            "cluster_id": cluster_id,
        }

    # =========================================================================
    # Phase 2: Adaptive Graph Crawl (Follow-the-Money)
    # =========================================================================

    def _follow_the_money(
        self, seed_entity: str, seed_amount: float = 0.0
    ) -> Dict[str, Any]:
        """
        BFS-based adaptive graph expansion from seed entity downstream.
        Only expands branches meeting significance/risk criteria.
        """
        visited_entities: Set[str] = set()
        visited_txids: Set[str] = set()
        discovered_entities: List[str] = [seed_entity]
        discovered_transactions: List[str] = []
        flow_path: List[Dict[str, Any]] = []
        max_depth_reached = 0

        # Resolve seed addresses
        seed_addresses = set(self.entity_profiler.get_entity_addresses(seed_entity))
        # Also look for output addresses from seed entity's transactions
        for tx in self._txs_by_entity.get(seed_entity, []):
            seed_addresses.update(tx.get("output_addresses", []))
            seed_addresses.update(tx.get("input_addresses", []))

        if seed_amount <= 0:
            # Estimate from entity transactions
            for tx in self._txs_by_entity.get(seed_entity, []):
                seed_amount = max(seed_amount, tx.get("total_output_btc", 0.0))
        seed_amount = max(seed_amount, 0.0001)  # Prevent division by zero

        # BFS Queue: (entity_id, hop_depth, incoming_amount, parent_entity, parent_txid)
        queue: deque = deque()

        # Seed the queue with downstream transactions from seed entity
        for tx in self._txs_by_entity.get(seed_entity, []):
            txid = tx.get("txid", "")
            if txid in visited_txids:
                continue
            visited_txids.add(txid)
            discovered_transactions.append(txid)

            # Find downstream entities (output addresses)
            for out_addr in tx.get("output_addresses", []):
                downstream_entity = self.entity_profiler.get_entity_for_address(out_addr)
                if downstream_entity and downstream_entity != seed_entity:
                    # Calculate amount flowing to this address
                    out_amount = 0.0
                    for output in tx.get("outputs", []):
                        if output.get("address") == out_addr:
                            out_amount += output.get("value_btc", 0.0)

                    queue.append((
                        downstream_entity,
                        1,  # hop 1
                        out_amount,
                        seed_entity,
                        txid,
                        tx.get("timestamp", 0),
                        out_addr,
                    ))

        visited_entities.add(seed_entity)

        while queue and len(discovered_entities) < self.max_entities:
            (
                entity_id, depth, incoming_amount,
                parent_entity, parent_txid, parent_ts, via_address
            ) = queue.popleft()

            # Skip if already visited
            if entity_id in visited_entities:
                continue

            # Skip if beyond max depth
            if depth > self.max_depth:
                continue

            # Evaluate expansion criteria
            should_expand, expansion_reasons = self._should_expand_branch(
                entity_id, incoming_amount, seed_amount, depth
            )

            visited_entities.add(entity_id)
            discovered_entities.append(entity_id)
            max_depth_reached = max(max_depth_reached, depth)

            # Calculate flow metrics for this step
            forwarding_ratio = incoming_amount / max(0.0001, seed_amount)
            pct_of_seed = round((incoming_amount / seed_amount) * 100, 2)

            flow_step = {
                "source_entity": parent_entity,
                "destination_entity": entity_id,
                "via_address": via_address,
                "transaction_id": parent_txid,
                "amount": round(incoming_amount, 6),
                "timestamp": parent_ts,
                "hop": depth,
                "forwarding_ratio": round(min(1.0, forwarding_ratio), 4),
                "cumulative_flow": round(incoming_amount, 6),
                "pct_of_seed": pct_of_seed,
                "expansion_reasons": expansion_reasons,
            }
            flow_path.append(flow_step)

            # If branch is worth expanding, continue BFS
            if should_expand and depth < self.max_depth:
                entity_txs = self._txs_by_entity.get(entity_id, [])
                # Also find transactions where this entity's addresses appear as input
                entity_addrs = set(self.entity_profiler.get_entity_addresses(entity_id))
                entity_addrs.add(via_address)

                for addr in entity_addrs:
                    for tx in self._txs_by_input_addr.get(addr, []):
                        txid = tx.get("txid", "")
                        if txid in visited_txids:
                            continue
                        visited_txids.add(txid)
                        discovered_transactions.append(txid)

                        # Time since previous transaction
                        tx_ts = tx.get("timestamp", 0)

                        for out_addr in tx.get("output_addresses", []):
                            ds_entity = self.entity_profiler.get_entity_for_address(out_addr)
                            if ds_entity and ds_entity not in visited_entities:
                                out_amount = 0.0
                                for output in tx.get("outputs", []):
                                    if output.get("address") == out_addr:
                                        out_amount += output.get("value_btc", 0.0)

                                queue.append((
                                    ds_entity,
                                    depth + 1,
                                    out_amount,
                                    entity_id,
                                    txid,
                                    tx_ts,
                                    out_addr,
                                ))

        return {
            "discovered_entities": discovered_entities,
            "discovered_transactions": discovered_transactions,
            "flow_path": flow_path,
            "max_depth_reached": max_depth_reached,
        }

    def _should_expand_branch(
        self,
        entity_id: str,
        incoming_amount: float,
        seed_amount: float,
        depth: int,
    ) -> Tuple[bool, List[str]]:
        """
        Evaluate whether a downstream entity branch deserves further expansion.
        Uses multiple criteria — not a simple amount threshold.
        """
        reasons = []

        # 1. Amount significance
        if seed_amount > 0 and (incoming_amount / seed_amount) >= self.flow_significance:
            reasons.append("flow_amount_significant")

        # 2. Entity has elevated risk
        entity_txs = self._txs_by_entity.get(entity_id, [])
        max_risk = 0.0
        for tx in entity_txs:
            max_risk = max(max_risk, tx.get("risk_score", 0))
        if max_risk >= 50:
            reasons.append(f"elevated_entity_risk ({max_risk:.0f})")

        # 3. Rapid forwarding detection
        for tx in entity_txs:
            if tx.get("timestamp", 0) > 0:
                entity_addrs = set(self.entity_profiler.get_entity_addresses(entity_id))
                # Check if this entity quickly forwards received funds
                for out_tx in entity_txs:
                    time_delta = abs(out_tx.get("timestamp", 0) - tx.get("timestamp", 0))
                    if 0 < time_delta <= self.rapid_forward_sec:
                        reasons.append("rapid_forwarding_detected")
                        break
                if "rapid_forwarding_detected" in reasons:
                    break

        # 4. Suspicious pattern signals
        for tx in entity_txs:
            signals = tx.get("signals", [])
            suspicious = {"peel_chain_pattern", "rapid_forwarding", "mixing_detected",
                          "coinjoin_structure", "fan_out_dispersion"}
            if set(signals) & suspicious:
                reasons.append("suspicious_pattern_continues")
                break

        # 5. Graph structural importance
        graph_features = self.graph.get_node_features(entity_id)
        if graph_features.get("degree", 0) >= 4:
            reasons.append("structurally_important_node")

        # Expand if at least one reason exists, or if at depth 1 (always expand first hop)
        should_expand = len(reasons) > 0 or depth <= 1
        return should_expand, reasons

    # =========================================================================
    # Phase 4: Analytical Role Assignment
    # =========================================================================

    def _assign_roles(
        self,
        seed_entity: str,
        discovered_entities: List[str],
        flow_path: List[Dict[str, Any]],
    ) -> Dict[str, str]:
        """
        Assign analytical roles to discovered nodes based on observable
        graph/flow behaviour. These are analytical roles, NOT criminal claims.
        """
        roles: Dict[str, str] = {}

        # Seed entity is always SOURCE
        roles[seed_entity] = ROLE_SOURCE

        # Build flow metrics per entity
        entity_in_flows: Dict[str, List[Dict]] = {}
        entity_out_flows: Dict[str, List[Dict]] = {}

        for step in flow_path:
            src = step["source_entity"]
            dst = step["destination_entity"]
            entity_out_flows.setdefault(src, []).append(step)
            entity_in_flows.setdefault(dst, []).append(step)

        for entity_id in discovered_entities:
            if entity_id == seed_entity:
                continue

            in_flows = entity_in_flows.get(entity_id, [])
            out_flows = entity_out_flows.get(entity_id, [])
            entity_txs = self._txs_by_entity.get(entity_id, [])

            in_count = len(in_flows)
            out_count = len(out_flows)
            total_in = sum(f["amount"] for f in in_flows)
            total_out = sum(f["amount"] for f in out_flows)

            # Graph topology
            graph_features = self.graph.get_node_features(entity_id)
            in_degree = graph_features.get("in_degree", 0)
            out_degree = graph_features.get("out_degree", 0)

            # Check for rapid forwarding
            is_rapid_forward = False
            for step in in_flows:
                for out_step in out_flows:
                    if out_step.get("timestamp", 0) > 0 and step.get("timestamp", 0) > 0:
                        delta = abs(out_step["timestamp"] - step["timestamp"])
                        if 0 < delta <= self.rapid_forward_sec:
                            is_rapid_forward = True
                            break

            fwd_ratio = total_out / max(0.0001, total_in)

            # Role assignment logic
            if in_degree >= 5 and out_degree <= 2:
                roles[entity_id] = ROLE_CONSOLIDATION
            elif in_degree <= 2 and out_degree >= 5:
                roles[entity_id] = ROLE_DISPERSAL
            elif in_count >= 3 and out_count <= 1:
                roles[entity_id] = ROLE_CONVERGENCE
            elif fwd_ratio >= 0.85 and is_rapid_forward:
                roles[entity_id] = ROLE_LAYERING
            elif out_count == 0 and in_count >= 1:
                roles[entity_id] = ROLE_EXIT_CANDIDATE
            elif in_count >= 1 and out_count >= 1:
                roles[entity_id] = ROLE_INTERMEDIARY
            else:
                roles[entity_id] = ROLE_UNKNOWN

        return roles

    # =========================================================================
    # Phase 5: Pattern Integration
    # =========================================================================

    def _integrate_patterns(
        self,
        discovered_txids: List[str],
        flow_path: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Run existing pattern detectors on discovered transactions
        and aggregate results. Reuses BitcoinRulesEngine.
        """
        patterns: List[Dict[str, Any]] = []
        seen_pattern_keys: Set[str] = set()

        for txid in discovered_txids:
            tx = self._tx_by_id.get(txid)
            if not tx:
                continue

            # Reuse existing heuristic evaluator
            rule_eval = BitcoinRulesEngine.evaluate_heuristics(tx)
            signals = rule_eval.get("signals", [])

            # Find hop for this transaction
            hop = 0
            for step in flow_path:
                if step.get("transaction_id") == txid:
                    hop = step.get("hop", 0)
                    break

            # Map signals to pattern records
            for signal in signals:
                pattern_key = f"{signal}_{txid[:8]}"
                if pattern_key in seen_pattern_keys:
                    continue
                seen_pattern_keys.add(pattern_key)

                pattern_type = signal.upper().replace("_PATTERN", "").replace("_", " ")
                confidence = "HIGH" if rule_eval.get("rule_score", 0) >= 50 else "MEDIUM"

                patterns.append({
                    "pattern_type": pattern_type,
                    "involved_entities": [tx.get("entity_id", "")],
                    "involved_transactions": [txid],
                    "confidence": confidence,
                    "severity": rule_eval.get("rule_score", 0),
                    "evidence": signal,
                    "hop": hop,
                    "timestamp_range": {
                        "start": tx.get("timestamp", 0),
                        "end": tx.get("timestamp", 0),
                    },
                })

        # Sort by severity descending
        patterns.sort(key=lambda p: p.get("severity", 0), reverse=True)
        return patterns

    # =========================================================================
    # Phase 6: Risk Propagation (Investigation-Scoped)
    # =========================================================================

    def _propagate_risk(
        self, seed_entity: str, discovered_txids: List[str]
    ) -> Dict[str, Any]:
        """
        Run risk propagation on the investigation subgraph using the
        existing RiskPropagationEngine. Returns both direct and propagated risks.
        """
        prop_engine = RiskPropagationEngine()

        # Build subgraph from discovered transactions
        subgraph_txs = []
        for txid in discovered_txids:
            tx = self._tx_by_id.get(txid)
            if tx:
                subgraph_txs.append(tx)

        prop_engine.build_from_transactions(subgraph_txs)
        prop_engine.seed_illicit(seed_entity, risk=1.0)

        # Also seed addresses of the seed entity
        for addr in self.entity_profiler.get_entity_addresses(seed_entity):
            prop_engine.seed_illicit(addr, risk=0.9)

        all_scores = prop_engine.propagate()

        # Gather direct risks (from existing risk scores)
        entity_risks: Dict[str, Dict[str, float]] = {}
        for txid in discovered_txids:
            tx = self._tx_by_id.get(txid, {})
            eid = tx.get("entity_id", "")
            if eid:
                direct = tx.get("risk_score", 0) / 100.0  # Normalize 0-100 to 0-1
                propagated = all_scores.get(eid, 0.0)
                if eid not in entity_risks:
                    entity_risks[eid] = {
                        "direct_risk": round(direct, 4),
                        "propagated_risk": round(propagated, 4),
                    }
                else:
                    entity_risks[eid]["direct_risk"] = max(
                        entity_risks[eid]["direct_risk"], round(direct, 4)
                    )
                    entity_risks[eid]["propagated_risk"] = max(
                        entity_risks[eid]["propagated_risk"], round(propagated, 4)
                    )

        return {
            "entity_risks": entity_risks,
            "propagation_summary": prop_engine.get_propagation_summary(),
            "high_risk_nodes": prop_engine.get_high_risk_nodes(threshold=0.2),
        }

    # =========================================================================
    # Phase 7: Build Investigation Graph Response
    # =========================================================================

    def _build_investigation_graph(
        self,
        seed_entity: str,
        discovered_entities: List[str],
        discovered_txids: List[str],
        flow_path: List[Dict[str, Any]],
        node_roles: Dict[str, str],
        prop_results: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Build graph response suitable for frontend rendering."""
        entity_risks = prop_results.get("entity_risks", {})
        nodes = []
        edges = []
        seen_nodes: Set[str] = set()

        for entity_id in discovered_entities:
            if entity_id in seen_nodes:
                continue
            seen_nodes.add(entity_id)

            entity_txs = self._txs_by_entity.get(entity_id, [])
            tx_count = len(entity_txs)
            risk_info = entity_risks.get(entity_id, {})

            nodes.append({
                "id": entity_id,
                "label": f"ENT:{entity_id[:10]}",
                "type": "entity",
                "role": node_roles.get(entity_id, ROLE_UNKNOWN),
                "risk_score": round(risk_info.get("direct_risk", 0) * 100, 1),
                "direct_risk": risk_info.get("direct_risk", 0),
                "propagated_risk": risk_info.get("propagated_risk", 0),
                "tx_count": tx_count,
                "is_seed": entity_id == seed_entity,
                "investigation_relevance": 1.0 if entity_id == seed_entity else 0.5,
            })

        for step in flow_path:
            edges.append({
                "source": step["source_entity"],
                "target": step["destination_entity"],
                "transaction_id": step.get("transaction_id", ""),
                "amount": step["amount"],
                "timestamp": step.get("timestamp", 0),
                "hop": step["hop"],
                "flow_percentage": step.get("pct_of_seed", 0),
                "pattern_association": "",
                "edge_type": "FLOW",
            })

        return {"nodes": nodes, "edges": edges, "seed": seed_entity, "max_depth": self.max_depth}

    # =========================================================================
    # Phase 8: Lead Ranking
    # =========================================================================

    def _rank_leads(
        self,
        seed_entity: str,
        discovered_entities: List[str],
        node_roles: Dict[str, str],
        prop_results: Dict[str, Any],
        flow_path: List[Dict[str, Any]],
        detected_patterns: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Rank discovered entities as investigative leads using existing risk
        signals combined with investigation-specific evidence.
        """
        entity_risks = prop_results.get("entity_risks", {})
        leads: List[Dict[str, Any]] = []

        # Build pattern map per entity
        entity_patterns: Dict[str, List[str]] = {}
        for p in detected_patterns:
            for eid in p.get("involved_entities", []):
                entity_patterns.setdefault(eid, []).append(p["pattern_type"])

        # Build flow stats per entity
        entity_flow_stats: Dict[str, Dict[str, Any]] = {}
        for step in flow_path:
            dst = step["destination_entity"]
            if dst not in entity_flow_stats:
                entity_flow_stats[dst] = {
                    "total_flow": 0.0,
                    "max_forwarding_ratio": 0.0,
                    "hop": step["hop"],
                    "tx_count": 0,
                }
            entity_flow_stats[dst]["total_flow"] += step["amount"]
            entity_flow_stats[dst]["max_forwarding_ratio"] = max(
                entity_flow_stats[dst]["max_forwarding_ratio"],
                step.get("forwarding_ratio", 0),
            )
            entity_flow_stats[dst]["tx_count"] += 1

        for entity_id in discovered_entities:
            if entity_id == seed_entity:
                continue  # Seed is not a lead

            risk_info = entity_risks.get(entity_id, {})
            direct_risk = risk_info.get("direct_risk", 0)
            propagated_risk = risk_info.get("propagated_risk", 0)
            role = node_roles.get(entity_id, ROLE_UNKNOWN)
            patterns = entity_patterns.get(entity_id, [])
            flow_stats = entity_flow_stats.get(entity_id, {})

            # Composite lead score from existing signals + investigation evidence
            reasons = []
            score_components = []

            # 1. Direct behavioral risk
            if direct_risk >= 0.5:
                reasons.append("behavioral_deviation")
                score_components.append(direct_risk * 30)

            # 2. Propagated risk from seed
            if propagated_risk >= 0.3:
                reasons.append("connected_to_elevated_risk_entities")
                score_components.append(propagated_risk * 25)

            # 3. Flow significance
            fwd_ratio = flow_stats.get("max_forwarding_ratio", 0)
            if fwd_ratio >= 0.5:
                reasons.append("high_downstream_flow_retention")
                score_components.append(fwd_ratio * 20)

            # 4. Rapid forwarding
            if role == ROLE_LAYERING:
                reasons.append("rapid_forwarding_layering")
                score_components.append(15)

            # 5. Detected patterns
            if patterns:
                reasons.append(f"detected_patterns ({', '.join(set(patterns))})")
                score_components.append(min(20, len(set(patterns)) * 8))

            # 6. Graph importance
            graph_features = self.graph.get_node_features(entity_id)
            if graph_features.get("pagerank", 0) > 0.005:
                reasons.append("graph_importance")
                score_components.append(10)

            # 7. Role-based boost
            role_boost = {
                ROLE_LAYERING: 15, ROLE_CONSOLIDATION: 10, ROLE_DISPERSAL: 10,
                ROLE_EXIT_CANDIDATE: 12, ROLE_CONVERGENCE: 8,
            }.get(role, 0)
            if role_boost:
                score_components.append(role_boost)

            composite_score = min(100, sum(score_components))

            if composite_score < 10 and not reasons:
                continue  # Skip low-evidence entities

            # Priority classification
            if composite_score >= 75:
                priority = "P1"
                risk_label = "CRITICAL"
            elif composite_score >= 50:
                priority = "P2"
                risk_label = "HIGH"
            elif composite_score >= 25:
                priority = "P3"
                risk_label = "MEDIUM"
            else:
                priority = "P4"
                risk_label = "LOW"

            leads.append({
                "entity_id": entity_id,
                "priority": priority,
                "risk_label": risk_label,
                "composite_score": round(composite_score, 1),
                "direct_risk": round(direct_risk, 4),
                "propagated_risk": round(propagated_risk, 4),
                "role": role,
                "reasons": reasons,
                "evidence_summary": {
                    "tx_count": flow_stats.get("tx_count", 0),
                    "connected_entities": len(discovered_entities) - 1,
                    "detected_patterns": len(set(patterns)),
                    "downstream_hops": flow_stats.get("hop", 0),
                    "total_flow_btc": round(flow_stats.get("total_flow", 0), 6),
                },
            })

        # Sort by composite score descending
        leads.sort(key=lambda l: l["composite_score"], reverse=True)
        return leads

    # =========================================================================
    # Phase 9: Evidence Generation
    # =========================================================================

    def _generate_evidence(self, investigation: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate structured evidence from actual computed data.
        Never fabricates — all values come from investigation phases.
        """
        seed_analysis = investigation.get("seed_analysis", {})
        flow_path = investigation.get("flow_path", [])
        patterns = investigation.get("detected_patterns", [])
        leads = investigation.get("final_leads", [])

        # Flow evidence
        seed_amount = seed_analysis.get("total_outflow", 0.0)
        downstream_amounts = [s["amount"] for s in flow_path] if flow_path else []
        max_hop = max((s.get("hop", 0) for s in flow_path), default=0)

        avg_fwd_ratio = 0.0
        if flow_path:
            ratios = [s.get("forwarding_ratio", 0) for s in flow_path]
            avg_fwd_ratio = sum(ratios) / max(1, len(ratios))

        # Pattern evidence
        pattern_types = list(set(p["pattern_type"] for p in patterns))

        return {
            "trigger": investigation.get("trigger_reasons", []),
            "flow_evidence": {
                "seed_amount": round(seed_amount, 6),
                "downstream_amount": round(sum(downstream_amounts), 6) if downstream_amounts else 0,
                "hop_count": max_hop,
                "forwarding_ratio": round(avg_fwd_ratio, 4),
                "total_flow_steps": len(flow_path),
            },
            "patterns": pattern_types,
            "entity_evidence": {
                "total_discovered": len(investigation.get("discovered_entities", [])),
                "total_transactions": len(investigation.get("discovered_transactions", [])),
                "total_leads": len(leads),
                "highest_lead_score": leads[0]["composite_score"] if leads else 0,
            },
            "risk_propagation": {
                "seed_entity": investigation.get("seed_entity_id", ""),
                "propagation_depth": max_hop,
            },
        }
