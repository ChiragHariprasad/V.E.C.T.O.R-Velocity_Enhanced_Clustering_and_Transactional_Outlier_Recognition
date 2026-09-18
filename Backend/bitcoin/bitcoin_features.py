"""
Bitcoin Feature Engineering Engine
Generates the comprehensive 50+ behavioral feature vector for entities/transactions across:
Volume, Frequency, Velocity (1h/6h/24h), Temporal, Counterparty, UTXO, Flow, Graph, and Deviation.
"""

from typing import Dict, Any, List, Optional
import math
import statistics

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False

from bitcoin.schemas import BITCOIN_FEATURE_KEYS

class BitcoinFeatureEngine:
    @staticmethod
    def _mean(values: List[float]) -> float:
        if not values:
            return 0.0
        return sum(values) / len(values)

    @staticmethod
    def _median(values: List[float]) -> float:
        if not values:
            return 0.0
        s = sorted(values)
        n = len(s)
        mid = n // 2
        if n % 2 == 1:
            return float(s[mid])
        return (float(s[mid - 1]) + float(s[mid])) / 2.0

    @classmethod
    def compute_features(
        cls,
        tx: Dict[str, Any],
        entity_id: str,
        entity_history: List[Dict[str, Any]],
        utxo_stats: Dict[str, Any],
        graph_stats: Dict[str, Any],
        motif_stats: Dict[str, Any],
        entity_addresses: Optional[List[str]] = None
    ) -> Dict[str, float]:
        """
        Build the canonical feature dictionary conforming to BITCOIN_FEATURE_KEYS.
        Derives real behavioral and accounting features from entity history and transaction UTXOs.
        """
        current_amount = float(tx.get("total_output_btc", 0.0))
        tx_count = len(entity_history) + 1
        all_txs = list(entity_history) + [tx]
        
        amounts = [float(t.get("total_output_btc", 0.0)) for t in all_txs]
        avg_amount = cls._mean(amounts)
        median_amount = cls._median(amounts)
        max_amount = max(amounts) if amounts else 0.0
        min_amount = min(amounts) if amounts else 0.0

        # --- Real Inflow / Outflow Accounting (No 0.95 heuristic multiplier) ---
        addr_set = set(entity_addresses) if entity_addresses else set()
        if not addr_set and tx.get("input_addresses"):
            addr_set.update(tx.get("input_addresses", []))

        total_received = 0.0
        total_sent = 0.0
        sent_tx_count = 0
        received_tx_count = 0

        for t in all_txs:
            t_inputs = t.get("inputs", [])
            t_outputs = t.get("outputs", [])
            t_in_addrs = set(t.get("input_addresses", []))
            t_out_addrs = set(t.get("output_addresses", []))

            # Outflows (spent by entity)
            t_sent = 0.0
            if t_inputs:
                for inp in t_inputs:
                    if not addr_set or inp.get("address") in addr_set:
                        t_sent += float(inp.get("value_btc", 0.0))
            elif addr_set and (t_in_addrs & addr_set):
                t_sent = float(t.get("total_input_btc", 0.0))
            elif not addr_set and t is tx:
                t_sent = float(t.get("total_input_btc", 0.0))

            if t_sent > 0:
                total_sent += t_sent
                sent_tx_count += 1

            # Inflows (received by entity)
            t_rec = 0.0
            if t_outputs:
                for out in t_outputs:
                    if not addr_set or out.get("address") in addr_set:
                        t_rec += float(out.get("value_btc", 0.0))
            elif addr_set and (t_out_addrs & addr_set):
                t_rec = float(t.get("total_output_btc", 0.0))

            if t_rec > 0:
                total_received += t_rec
                received_tx_count += 1

        # Fallback if unaddressed synthetic tx: preserve conservation of mass
        if total_received == 0.0 and total_sent == 0.0:
            total_received = sum(amounts)
            total_sent = float(tx.get("total_input_btc", 0.0))

        # Velocity calculations
        # V = n / Δt
        now_ts = tx.get("timestamp") or 0
        txs_1h = sum(1 for t in entity_history if now_ts - t.get("timestamp", 0) <= 3600) + 1
        txs_6h = sum(1 for t in entity_history if now_ts - t.get("timestamp", 0) <= 21600) + 1
        txs_24h = sum(1 for t in entity_history if now_ts - t.get("timestamp", 0) <= 86400) + 1

        v_vol_1h = sum(float(t.get("total_output_btc", 0)) for t in entity_history if now_ts - t.get("timestamp", 0) <= 3600) + current_amount
        v_vol_24h = sum(float(t.get("total_output_btc", 0)) for t in entity_history if now_ts - t.get("timestamp", 0) <= 86400) + current_amount

        # Temporal features & Real Periodicity
        timestamps = sorted([t.get("timestamp", 0) for t in all_txs])
        if len(timestamps) > 1:
            intervals = [float(timestamps[i] - timestamps[i-1]) for i in range(1, len(timestamps))]
            mean_interval = cls._mean(intervals)
            median_interval = cls._median(intervals)
            min_interval = min(intervals)
            max_interval = max(intervals)

            # Mathematical periodicity calculation:
            # Regular arrival times have CV = std/mean -> 0 => periodicity -> 1.0
            # Erratic/bursty arrival times have CV >> 1 => periodicity -> 0.0
            if len(intervals) >= 2 and mean_interval > 0:
                variance = sum((x - mean_interval) ** 2 for x in intervals) / len(intervals)
                std_interval = math.sqrt(variance)
                cv = std_interval / mean_interval
                periodicity_score = 1.0 / (1.0 + cv)
            elif len(intervals) == 1:
                periodicity_score = 1.0 if intervals[0] > 0 else 0.0
            else:
                periodicity_score = 0.0
        else:
            mean_interval = 3600.0
            median_interval = 3600.0
            min_interval = 3600.0
            max_interval = 3600.0
            periodicity_score = 0.0

        burst_freq = 1.0 if min_interval < 60 else 0.0
        sudden_activity = 1.0 if (len(entity_history) >= 2 and max_interval > 86400 and (now_ts - timestamps[-2]) < 300) else 0.0

        # Counterparty features & Real Concentration / Repeated Interaction
        cp_interaction_counts: Dict[str, int] = {}
        for t in all_txs:
            for addr in t.get("output_addresses", []) + t.get("input_addresses", []):
                if addr and addr not in addr_set:
                    cp_interaction_counts[addr] = cp_interaction_counts.get(addr, 0) + 1

        unique_cp = len(cp_interaction_counts)
        total_cp_interactions = sum(cp_interaction_counts.values())

        # Mathematical Herfindahl-Hirschman Index (HHI) for counterparty concentration
        if total_cp_interactions > 0:
            hhi = sum((count / total_cp_interactions) ** 2 for count in cp_interaction_counts.values())
            counterparty_concentration = float(hhi)
        else:
            counterparty_concentration = 0.0

        # Proportion of unique counterparties re-engaged (>1 interaction)
        if unique_cp > 0:
            repeated_cps = sum(1 for count in cp_interaction_counts.values() if count > 1)
            repeated_cp_ratio = float(repeated_cps) / float(unique_cp)
        else:
            repeated_cp_ratio = 0.0

        # Flow features
        in_c = tx.get("input_count", 1)
        out_c = tx.get("output_count", 1)
        one_to_one = 1.0 if in_c == 1 and out_c == 1 else 0.0
        one_to_many = 1.0 if in_c == 1 and out_c > 1 else 0.0
        many_to_one = 1.0 if in_c > 1 and out_c == 1 else 0.0
        many_to_many = 1.0 if in_c > 1 and out_c > 1 else 0.0

        # Real Deviations from Historical Baseline
        vel_dev = abs(float(txs_1h) - (float(txs_24h) / 24.0))
        vol_dev = abs(current_amount - avg_amount) / max(0.1, avg_amount)

        # Counterparty deviation: relative difference between current tx counterparties and historical mean
        curr_tx_cps = len(set(tx.get("output_addresses", []) + tx.get("input_addresses", [])) - addr_set)
        if entity_history:
            hist_cp_counts = [
                len(set(t.get("output_addresses", []) + t.get("input_addresses", [])) - addr_set)
                for t in entity_history
            ]
            avg_hist_cps = cls._mean(hist_cp_counts)
            cp_dev = abs(float(curr_tx_cps) - avg_hist_cps) / max(1.0, avg_hist_cps)
        else:
            cp_dev = 0.0

        # Temporal deviation: relative difference between current interval and historical mean interval
        if entity_history and len(timestamps) >= 2:
            delta_t_curr = float(now_ts - timestamps[-2])
            hist_timestamps = sorted([t.get("timestamp", 0) for t in entity_history])
            if len(hist_timestamps) >= 2:
                hist_intervals = [float(hist_timestamps[i] - hist_timestamps[i-1]) for i in range(1, len(hist_timestamps))]
                base_interval = cls._mean(hist_intervals)
            else:
                base_interval = mean_interval
            temp_dev = abs(delta_t_curr - base_interval) / max(60.0, base_interval)
        else:
            temp_dev = 0.0

        feat_dict = {
            # Group A: Volume
            "tx_count": float(tx_count),
            "total_received_btc": round(float(total_received), 6),
            "total_sent_btc": round(float(total_sent), 6),
            "avg_tx_value": round(float(avg_amount), 6),
            "median_tx_value": round(float(median_amount), 6),
            "max_tx_value": round(float(max_amount), 6),
            "min_tx_value": round(float(min_amount), 6),
            "total_input_value": round(float(tx.get("total_input_btc", 0.0)), 6),
            "total_output_value": round(float(current_amount), 6),
            "total_fee_btc": round(float(tx.get("fee_btc", 0.0)), 6),

            # Group B: Frequency
            "tx_per_hour": round(float(txs_1h), 2),
            "tx_per_day": round(float(txs_24h), 2),
            "tx_per_week": round(float(txs_24h * 7), 2),
            "received_tx_count": float(received_tx_count or tx_count),
            "sent_tx_count": float(sent_tx_count or tx_count),

            # Group C: Velocity
            "tx_velocity_1h": round(float(txs_1h), 2),
            "tx_velocity_6h": round(float(txs_6h) / 6.0, 2),
            "tx_velocity_24h": round(float(txs_24h) / 24.0, 2),
            "volume_velocity_1h": round(float(v_vol_1h), 6),
            "volume_velocity_24h": round(float(v_vol_24h), 6),

            # Group D: Temporal
            "mean_inter_tx_time_sec": round(float(mean_interval), 2),
            "median_inter_tx_time_sec": round(float(median_interval), 2),
            "min_inter_tx_time_sec": round(float(min_interval), 2),
            "max_inter_tx_time_sec": round(float(max_interval), 2),
            "burst_frequency": float(burst_freq),
            "burst_duration_sec": 60.0 if burst_freq else 0.0,
            "activity_periodicity": round(float(periodicity_score), 4),
            "inactive_duration_hours": round(float(max_interval / 3600.0), 2),
            "sudden_activity_score": float(sudden_activity),

            # Group E: Counterparty
            "unique_counterparties": float(unique_cp),
            "incoming_counterparties": float(len(tx.get("input_addresses", []))),
            "outgoing_counterparties": float(len(tx.get("output_addresses", []))),
            "counterparty_growth_rate": float(unique_cp) / max(1.0, float(tx_count)),
            "counterparty_concentration": round(float(counterparty_concentration), 4),
            "repeated_counterparty_ratio": round(float(repeated_cp_ratio), 4),

            # Group F: UTXO
            "input_count": float(in_c),
            "output_count": float(out_c),
            "avg_input_count": float(in_c),
            "avg_output_count": float(out_c),
            "avg_utxo_age_blocks": float(utxo_stats.get("avg_utxo_age_blocks") or 0.0),
            "median_utxo_age_blocks": float(utxo_stats.get("median_utxo_age_blocks") or 0.0),
            "old_utxo_spending_ratio": float(utxo_stats.get("old_utxo_spending_ratio", 0.0)),
            "young_utxo_spending_ratio": float(utxo_stats.get("young_utxo_spending_ratio", 0.0)),
            "avg_input_value_btc": round(float(tx.get("total_input_btc", 0.0)) / max(1, in_c), 6),
            "avg_output_value_btc": round(float(current_amount) / max(1, out_c), 6),
            "utxo_fragmentation": float(utxo_stats.get("utxo_fragmentation", 0.0)),

            # Group G: Flow
            "one_to_one_ratio": float(one_to_one),
            "one_to_many_ratio": float(one_to_many),
            "many_to_one_ratio": float(many_to_one),
            "many_to_many_ratio": float(many_to_many),
            "fan_in_score": float(motif_stats.get("fan_in_score", 0.0)),
            "fan_out_score": float(motif_stats.get("fan_out_score", 0.0)),
            "flow_ratio": float(motif_stats.get("flow_ratio", 1.0)),
            "rapid_forwarding_score": float(motif_stats.get("rapid_forwarding_score", 0.0)),

            # Group H: Graph
            "degree": float(graph_stats.get("degree", 1.0)),
            "in_degree": float(graph_stats.get("in_degree", 1.0)),
            "out_degree": float(graph_stats.get("out_degree", 1.0)),
            "weighted_degree": float(graph_stats.get("weighted_degree", 1.0)),
            "pagerank": float(graph_stats.get("pagerank", 0.0001)),
            "betweenness_centrality": float(graph_stats.get("betweenness_centrality", 0.0)),
            "closeness_centrality": float(graph_stats.get("closeness_centrality", 0.0)),
            "clustering_coefficient": float(graph_stats.get("clustering_coefficient", 0.0)),

            # Group I: Deviation
            "velocity_deviation": round(float(vel_dev), 4),
            "volume_deviation": round(float(vol_dev), 4),
            "counterparty_deviation": round(float(cp_dev), 4),
            "temporal_deviation": round(float(temp_dev), 4)
        }

        return feat_dict

    @staticmethod
    def feature_dict_to_array(feat_dict: Dict[str, float]) -> List[float]:
        """Convert feature dictionary into an array/list in canonical order."""
        arr = [float(feat_dict.get(k, 0.0)) for k in BITCOIN_FEATURE_KEYS]
        if HAS_NUMPY:
            return np.array(arr, dtype=float)
        return arr
