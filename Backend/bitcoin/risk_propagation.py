"""
V.E.C.T.O.R-BITCOIN Risk Propagation Engine
Propagates risk scores from seed illicit wallets/entities across the transaction graph
using Label Spreading with exponential decay.

Algorithm:
  1. Seed known-illicit entities with risk = 1.0
  2. Iteratively propagate risk to connected nodes:
       risk(v) = max(risk(v), α * max(risk(neighbors)))
     where α is the decay factor (0 < α < 1)
  3. Converge after k iterations or when change < ε
"""

from typing import Dict, Any, List, Set, Optional, Tuple
from collections import defaultdict
import math


class RiskPropagationEngine:
    """
    Graph-based risk propagation using Label Spreading with decay.
    Operates on the transaction graph to propagate illicit risk outward
    from seed wallets through transaction hops.
    """

    def __init__(
        self,
        decay_factor: float = 0.65,
        max_iterations: int = 10,
        convergence_threshold: float = 0.001,
        min_risk_propagate: float = 0.05,
    ):
        """
        Args:
            decay_factor: Risk multiplier per hop (0.65 = 65% of parent risk per hop)
            max_iterations: Maximum propagation iterations
            convergence_threshold: Stop when max change < this value
            min_risk_propagate: Don't propagate risk below this threshold
        """
        self.decay = decay_factor
        self.max_iter = max_iterations
        self.epsilon = convergence_threshold
        self.min_risk = min_risk_propagate

        # Adjacency representation
        # node -> list of (neighbor, edge_weight)
        self._forward: Dict[str, List[Tuple[str, float]]] = defaultdict(list)
        self._backward: Dict[str, List[Tuple[str, float]]] = defaultdict(list)
        self._node_types: Dict[str, str] = {}  # node -> "address" | "transaction" | "entity"
        self._risk_scores: Dict[str, float] = {}
        self._seed_nodes: Set[str] = set()
        self._propagation_paths: Dict[str, List[str]] = {}  # node -> path from seed

    def add_edge(self, source: str, target: str, weight: float = 1.0):
        """Add a directed edge to the propagation graph."""
        self._forward[source].append((target, weight))
        self._backward[target].append((source, weight))

    def set_node_type(self, node: str, node_type: str):
        """Set the type of a node (address, transaction, entity)."""
        self._node_types[node] = node_type

    def seed_illicit(self, node: str, risk: float = 1.0):
        """Mark a node as a known-illicit seed with initial risk score."""
        self._risk_scores[node] = max(self._risk_scores.get(node, 0.0), risk)
        self._seed_nodes.add(node)
        self._propagation_paths[node] = [node]

    def build_from_transactions(self, transactions: List[Dict[str, Any]], seed_entities: List[str] = None):
        """
        Build the propagation graph from a list of parsed transactions.
        Each transaction creates edges: input_address -> txid -> output_address
        """
        for tx in transactions:
            txid = tx.get("txid", "")
            if not txid:
                continue

            self.set_node_type(txid, "transaction")

            # Input addresses -> Transaction
            for addr in tx.get("input_addresses", []):
                self.set_node_type(addr, "address")
                self.add_edge(addr, txid, weight=1.0)

            # Transaction -> Output addresses
            for addr in tx.get("output_addresses", []):
                self.set_node_type(addr, "address")
                self.add_edge(txid, addr, weight=1.0)

            # Entity linkage
            entity_id = tx.get("entity_id")
            if entity_id:
                self.set_node_type(entity_id, "entity")
                for addr in tx.get("input_addresses", []):
                    self.add_edge(entity_id, addr, weight=0.8)
                    self.add_edge(addr, entity_id, weight=0.8)

        # Seed illicit entities
        if seed_entities:
            for eid in seed_entities:
                self.seed_illicit(eid, risk=1.0)

    def propagate(self) -> Dict[str, float]:
        """
        Execute iterative risk propagation with exponential decay.
        Returns the final risk score for each node.
        """
        if not self._seed_nodes:
            return self._risk_scores

        # Initialize all non-seed nodes to 0
        all_nodes = set(self._forward.keys()) | set(self._backward.keys())
        for node in all_nodes:
            if node not in self._risk_scores:
                self._risk_scores[node] = 0.0

        for iteration in range(self.max_iter):
            max_change = 0.0
            updated_scores = dict(self._risk_scores)

            for node in all_nodes:
                if node in self._seed_nodes:
                    continue  # Seed nodes keep their initial risk

                # Gather max risk from all predecessors (backward neighbors)
                max_neighbor_risk = 0.0
                best_predecessor = None

                for neighbor, weight in self._backward.get(node, []):
                    neighbor_risk = self._risk_scores.get(neighbor, 0.0)
                    weighted_risk = neighbor_risk * weight
                    if weighted_risk > max_neighbor_risk:
                        max_neighbor_risk = weighted_risk
                        best_predecessor = neighbor

                # Also check forward neighbors (bidirectional propagation for entities)
                for neighbor, weight in self._forward.get(node, []):
                    neighbor_risk = self._risk_scores.get(neighbor, 0.0)
                    weighted_risk = neighbor_risk * weight * 0.5  # Lower weight for forward
                    if weighted_risk > max_neighbor_risk:
                        max_neighbor_risk = weighted_risk
                        best_predecessor = neighbor

                # Apply decay
                propagated_risk = max_neighbor_risk * self.decay

                if propagated_risk > self.min_risk and propagated_risk > updated_scores[node]:
                    change = propagated_risk - updated_scores[node]
                    max_change = max(max_change, change)
                    updated_scores[node] = propagated_risk

                    # Track propagation path
                    if best_predecessor and best_predecessor in self._propagation_paths:
                        self._propagation_paths[node] = self._propagation_paths[best_predecessor] + [node]
                    else:
                        self._propagation_paths[node] = [node]

            self._risk_scores = updated_scores

            if max_change < self.epsilon:
                break

        return self._risk_scores

    def get_risk_score(self, node: str) -> float:
        """Get the propagated risk score for a node."""
        return self._risk_scores.get(node, 0.0)

    def get_propagation_path(self, node: str) -> List[str]:
        """Get the path through which risk was propagated to this node."""
        return self._propagation_paths.get(node, [])

    def get_high_risk_nodes(self, threshold: float = 0.3) -> List[Dict[str, Any]]:
        """Get all nodes with propagated risk above threshold, sorted by risk."""
        results = []
        for node, score in self._risk_scores.items():
            if score >= threshold:
                path = self.get_propagation_path(node)
                results.append({
                    "node": node,
                    "node_type": self._node_types.get(node, "unknown"),
                    "risk_score": round(score, 4),
                    "is_seed": node in self._seed_nodes,
                    "hops_from_seed": max(0, len(path) - 1),
                    "propagation_path": path,
                })
        results.sort(key=lambda x: x["risk_score"], reverse=True)
        return results

    def get_propagation_summary(self) -> Dict[str, Any]:
        """Get summary statistics of the risk propagation."""
        scores = list(self._risk_scores.values())
        non_zero = [s for s in scores if s > 0]

        high_risk = sum(1 for s in scores if s >= 0.75)
        medium_risk = sum(1 for s in scores if 0.3 <= s < 0.75)
        low_risk = sum(1 for s in scores if 0.05 <= s < 0.3)

        return {
            "total_nodes": len(scores),
            "seed_count": len(self._seed_nodes),
            "non_zero_risk_count": len(non_zero),
            "high_risk_count": high_risk,
            "medium_risk_count": medium_risk,
            "low_risk_count": low_risk,
            "max_risk": round(max(scores) if scores else 0.0, 4),
            "mean_risk": round(sum(non_zero) / max(1, len(non_zero)), 4),
            "decay_factor": self.decay,
            "seeds": list(self._seed_nodes),
        }

    def explain_risk(self, node: str) -> str:
        """Generate human-readable explanation of why a node has its risk score."""
        score = self.get_risk_score(node)
        if score == 0:
            return f"Node {node} has no propagated risk — not connected to any illicit seed."

        path = self.get_propagation_path(node)
        if node in self._seed_nodes:
            return f"Node {node} is a SEED illicit entity with risk score {score:.2f}."

        hops = max(0, len(path) - 1)
        seed = path[0] if path else "unknown"

        explanation = (
            f"Node {node} ({self._node_types.get(node, 'unknown')}) has propagated risk "
            f"score {score:.2f}, received through {hops} hop(s) from seed entity {seed}. "
            f"Propagation path: {' → '.join(p[:12] + '...' if len(p) > 12 else p for p in path)}."
        )
        return explanation
