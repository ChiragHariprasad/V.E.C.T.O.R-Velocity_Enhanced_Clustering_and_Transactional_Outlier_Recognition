"""
Bitcoin Multi-Model Risk Engine & Explainability Generator
Combines ML anomaly detection, graph centrality metrics, velocity deviation,
UTXO patterns, and behavioral heuristics into a calibrated 0-100 risk score
with human-understandable investigative explanations.
"""

from typing import Dict, Any, List, Optional
from bitcoin.config import (
    RISK_WEIGHT_ML,
    RISK_WEIGHT_GRAPH,
    RISK_WEIGHT_VELOCITY,
    RISK_WEIGHT_TEMPORAL,
    RISK_WEIGHT_UTXO,
    RISK_WEIGHT_RULES
)
from bitcoin.schemas import get_risk_level

class BitcoinRiskEngine:
    def __init__(
        self,
        w_ml: float = RISK_WEIGHT_ML,
        w_graph: float = RISK_WEIGHT_GRAPH,
        w_vel: float = RISK_WEIGHT_VELOCITY,
        w_temp: float = RISK_WEIGHT_TEMPORAL,
        w_utxo: float = RISK_WEIGHT_UTXO,
        w_rules: float = RISK_WEIGHT_RULES
    ):
        self.w_ml = w_ml
        self.w_graph = w_graph
        self.w_vel = w_vel
        self.w_temp = w_temp
        self.w_utxo = w_utxo
        self.w_rules = w_rules

    def evaluate_risk(
        self,
        ml_score: Optional[float],  # 0.0 to 1.0 (from Isolation Forest / XGBoost) or None if unavailable
        model_type: str,            # "isolation_forest_cluster_X", "xgboost_cold_start", "xgboost_fallback", or "ML_UNAVAILABLE"
        features: Dict[str, float],
        rule_eval: Dict[str, Any],
        graph_stats: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Compute normalized risk score and generate lead explanation.
        Gracefully handles ML_UNAVAILABLE by pro-rating remaining component weights.
        """
        ml_available = (ml_score is not None and model_type != "ML_UNAVAILABLE")

        # Component 1: ML Score (0 to 100)
        ml_comp = min(100.0, max(0.0, float(ml_score) * 100.0)) if ml_available else None

        # Component 2: Graph Component (PageRank + Degree + Motifs)
        pagerank = graph_stats.get("pagerank", 0.0001)
        deg = graph_stats.get("degree", 1.0)
        graph_comp = min(100.0, (pagerank * 5000.0) + min(50.0, deg * 3.0))

        # Component 3: Velocity Component
        v_1h = features.get("tx_velocity_1h", 1.0)
        vel_dev = features.get("velocity_deviation", 0.0)
        vel_comp = min(100.0, (v_1h * 15.0) + (vel_dev * 10.0))

        # Component 4: Temporal Component
        burst = features.get("burst_frequency", 0.0)
        sudden = features.get("sudden_activity_score", 0.0)
        temp_comp = min(100.0, (burst * 50.0) + (sudden * 50.0))

        # Component 5: UTXO Component
        old_ratio = features.get("old_utxo_spending_ratio", 0.0)
        young_ratio = features.get("young_utxo_spending_ratio", 0.0)
        utxo_comp = min(100.0, (old_ratio * 40.0) + (young_ratio * 40.0))

        # Component 6: Rule / Heuristic Component
        rule_comp = float(rule_eval.get("rule_score", 0.0))

        # Weighted composite score
        if ml_available:
            composite_score = (
                self.w_ml * ml_comp +
                self.w_graph * graph_comp +
                self.w_vel * vel_comp +
                self.w_temp * temp_comp +
                self.w_utxo * utxo_comp +
                self.w_rules * rule_comp
            )
        else:
            # Pro-rate across remaining components without fabricating fake ML score
            non_ml_weights = (
                self.w_graph + self.w_vel + self.w_temp + self.w_utxo + self.w_rules
            )
            raw_sum = (
                self.w_graph * graph_comp +
                self.w_vel * vel_comp +
                self.w_temp * temp_comp +
                self.w_utxo * utxo_comp +
                self.w_rules * rule_comp
            )
            composite_score = (raw_sum / non_ml_weights) if non_ml_weights > 0 else 0.0

        composite_score = round(min(100.0, max(0.0, composite_score)), 2)
        risk_level = get_risk_level(composite_score)

        # Generate Explainability & Evidence
        explanations = []
        signals = list(rule_eval.get("signals", []))

        if ml_available:
            if ml_comp > 70.0:
                explanations.append(f"Strong ML behavioral anomaly detected ({model_type}: score {ml_score:.2f}).")
        else:
            signals.append("ml_unavailable")
            explanations.append("ML anomaly model unavailable; composite risk derived from structural and behavioral indicators.")

        if v_1h >= 4:
            explanations.append(f"High transaction velocity ({v_1h:.0f} tx/hr), exceeding baseline.")
            signals.append("velocity_spike")
        if graph_comp > 60.0:
            explanations.append(f"Elevated graph centrality and structural connectivity (PageRank: {pagerank:.5f}).")
            signals.append("graph_centrality_spike")
        if burst > 0:
            explanations.append("Rapid transaction bursts occurring within short sub-minute intervals.")
            signals.append("burst_activity")
        if old_ratio > 0.5:
            explanations.append("Long-dormant UTXOs moved suddenly after prolonged inactivity.")
            signals.append("dormant_awakening")
        if rule_eval.get("is_peel_chain"):
            explanations.append("Consecutive peel-chain structure identified with asymmetric change splits.")

        if not explanations:
            explanations.append("Transaction characteristics conform to standard behavioral baseline.")

        return {
            "risk_score": composite_score,
            "risk_level": risk_level,
            "components": {
                "ml_score": round(ml_comp, 2) if ml_available else None,
                "graph_score": round(graph_comp, 2),
                "velocity_score": round(vel_comp, 2),
                "temporal_score": round(temp_comp, 2),
                "utxo_score": round(utxo_comp, 2),
                "rule_score": round(rule_comp, 2)
            },
            "model_type": model_type,
            "signals": list(set(signals)),
            "explanation": " ".join(explanations)
        }
