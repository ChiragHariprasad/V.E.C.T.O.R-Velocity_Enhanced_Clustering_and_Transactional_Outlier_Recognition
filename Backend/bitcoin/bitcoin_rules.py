"""
Bitcoin Behavioral Heuristics & Pattern Detection
Implements probabilistic heuristics (Peel Chains, Rapid Forwarding, Fan-In/Fan-Out,
Dormant Awakening, Change Output, CoinJoin/Mixing, Network-Layer Anomalies)
without claiming deterministic identity proof.
"""

from typing import Dict, Any, List, Optional
import time

# Import IP correlator utilities for network-layer checks
try:
    from bitcoin.ip_correlator import is_tor_exit, is_vpn_likely
except ImportError:
    def is_tor_exit(ip: str) -> bool:
        return ip.startswith("10.255.") or ip.startswith("10.254.")
    def is_vpn_likely(ip: str) -> bool:
        return False


class BitcoinRulesEngine:
    @staticmethod
    def evaluate_heuristics(
        tx: Dict[str, Any],
        entity_history: Optional[List[Dict[str, Any]]] = None,
        utxo_stats: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Evaluate heuristic rules and compute rule confidence scores.
        """
        signals = []
        rule_score = 0.0

        in_count = tx.get("input_count", 1)
        out_count = tx.get("output_count", 1)
        total_btc = tx.get("total_output_btc", 0.0)

        # 1. Peel Chain Detection (Large input -> One main output + One small change output)
        is_peel_chain = False
        if in_count == 1 and out_count == 2:
            outs = tx.get("outputs", [])
            val0, val1 = outs[0].get("value_btc", 0.0), outs[1].get("value_btc", 0.0)
            ratio = min(val0, val1) / max(0.0001, max(val0, val1))
            if ratio < 0.15 and max(val0, val1) > 0.5:
                is_peel_chain = True
                signals.append("peel_chain_pattern")
                rule_score += 35.0

        # 2. Fan-In (Consolidation: many inputs -> 1 or 2 outputs)
        if in_count >= 5 and out_count <= 2:
            signals.append("fan_in_consolidation")
            rule_score += 25.0

        # 3. Fan-Out (Distribution: 1 or 2 inputs -> many outputs)
        if in_count <= 2 and out_count >= 8:
            signals.append("fan_out_dispersion")
            rule_score += 25.0

        # 4. Rapid Forwarding (Short inter-transaction pass-through)
        if utxo_stats and utxo_stats.get("young_utxo_spending_ratio", 0) > 0.8:
            signals.append("rapid_forwarding")
            rule_score += 30.0

        # 5. Dormant-to-Active Awakening (Spending UTXOs older than 1000 blocks / ~7 days)
        if utxo_stats and utxo_stats.get("avg_utxo_age_blocks", 0) > 1000:
            signals.append("dormant_utxo_awakening")
            rule_score += 20.0

        # 6. High Value Anomaly
        if total_btc >= 10.0:
            signals.append("high_value_transfer")
            rule_score += 15.0

        # 7. Common-Input Heuristic Flag
        if in_count >= 2:
            signals.append("common_input_relationship")

        # 8. CoinJoin Detection (many inputs + many equal-value outputs)
        is_coinjoin = False
        coinjoin_score = 0.0
        if in_count >= 3 and out_count >= 3:
            outs = tx.get("outputs", [])
            if len(outs) >= 3:
                out_vals = [round(o.get("value_btc", 0.0), 4) for o in outs if not o.get("is_op_return")]
                if out_vals:
                    # Count the most common output value
                    val_counts: Dict[float, int] = {}
                    for v in out_vals:
                        val_counts[v] = val_counts.get(v, 0) + 1
                    max_equal = max(val_counts.values()) if val_counts else 0
                    equal_ratio = max_equal / len(out_vals)

                    # CoinJoin: majority of outputs have equal value, many participants
                    if max_equal >= 3 and equal_ratio >= 0.4:
                        is_coinjoin = True
                        coinjoin_score = min(1.0, equal_ratio * (max_equal / 5.0))
                        signals.append("coinjoin_structure")
                        rule_score += 30.0

                        if in_count >= 5 and max_equal >= 5:
                            signals.append("coinjoin_high_participant")
                            rule_score += 10.0

        # 9. Mixing Score (combination of CoinJoin, fan-out, rapid forwarding indicators)
        mixing_score = 0.0
        if is_coinjoin:
            mixing_score = coinjoin_score * 0.6
        if "rapid_forwarding" in signals:
            mixing_score += 0.25
        if "fan_out_dispersion" in signals:
            mixing_score += 0.15
        mixing_score = min(1.0, mixing_score)
        if mixing_score > 0.5:
            signals.append("mixing_detected")

        # 10. Network-Layer Anomaly Detection
        src_ip = tx.get("src_ip", "")
        if src_ip:
            # Tor exit node usage
            if is_tor_exit(src_ip):
                signals.append("tor_exit_node")
                rule_score += 20.0

            # VPN/hosting provider usage
            if is_vpn_likely(src_ip):
                signals.append("vpn_hosting_provider")
                rule_score += 10.0

        # 11. Geographic Mismatch (if entity has known country but tx relayed from different)
        geo_country = tx.get("geo_country", "")
        if geo_country == "XX":
            signals.append("anonymized_origin")
            rule_score += 15.0

        # Clamp rule score to [0, 100]
        rule_score = min(100.0, rule_score)

        return {
            "rule_score": round(rule_score, 2),
            "signals": signals,
            "is_peel_chain": is_peel_chain,
            "is_coinjoin": is_coinjoin,
            "coinjoin_score": round(coinjoin_score, 4),
            "mixing_score": round(mixing_score, 4),
        }
