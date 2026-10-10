"""
V.E.C.T.O.R-BITCOIN Schemas & Constants
Defines canonical feature keys, script types, risk categorizations, and entity models.
"""

# Canonical Feature Keys for Bitcoin (50+ engineered behavioral features)
BITCOIN_FEATURE_KEYS = [
    # Feature Group A: Volume
    "tx_count",
    "total_received_btc",
    "total_sent_btc",
    "avg_tx_value",
    "median_tx_value",
    "max_tx_value",
    "min_tx_value",
    "total_input_value",
    "total_output_value",
    "total_fee_btc",

    # Feature Group B: Frequency
    "tx_per_hour",
    "tx_per_day",
    "tx_per_week",
    "received_tx_count",
    "sent_tx_count",

    # Feature Group C: Velocity
    "tx_velocity_1h",
    "tx_velocity_6h",
    "tx_velocity_24h",
    "volume_velocity_1h",
    "volume_velocity_24h",

    # Feature Group D: Temporal
    "mean_inter_tx_time_sec",
    "median_inter_tx_time_sec",
    "min_inter_tx_time_sec",
    "max_inter_tx_time_sec",
    "burst_frequency",
    "burst_duration_sec",
    "activity_periodicity",
    "inactive_duration_hours",
    "sudden_activity_score",

    # Feature Group E: Counterparty
    "unique_counterparties",
    "incoming_counterparties",
    "outgoing_counterparties",
    "counterparty_growth_rate",
    "counterparty_concentration",
    "repeated_counterparty_ratio",

    # Feature Group F: UTXO
    "input_count",
    "output_count",
    "avg_input_count",
    "avg_output_count",
    "avg_utxo_age_blocks",
    "median_utxo_age_blocks",
    "old_utxo_spending_ratio",
    "young_utxo_spending_ratio",
    "avg_input_value_btc",
    "avg_output_value_btc",
    "utxo_fragmentation",

    # Feature Group G: Flow
    "one_to_one_ratio",
    "one_to_many_ratio",
    "many_to_one_ratio",
    "many_to_many_ratio",
    "fan_in_score",
    "fan_out_score",
    "flow_ratio",
    "rapid_forwarding_score",

    # Feature Group H: Graph
    "degree",
    "in_degree",
    "out_degree",
    "weighted_degree",
    "pagerank",
    "betweenness_centrality",
    "closeness_centrality",
    "clustering_coefficient",

    # Feature Group I: Deviation
    "velocity_deviation",
    "volume_deviation",
    "counterparty_deviation",
    "temporal_deviation"
]

NUM_BITCOIN_FEATURES = len(BITCOIN_FEATURE_KEYS)

SCRIPT_TYPES = {
    "P2PKH": "Pay-to-PubKey-Hash",
    "P2SH": "Pay-to-Script-Hash",
    "P2WPKH": "Pay-to-Witness-PubKey-Hash (SegWit)",
    "P2WSH": "Pay-to-Witness-Script-Hash",
    "P2TR": "Pay-to-Taproot",
    "NULL_DATA": "OP_RETURN Metadata",
    "UNKNOWN": "Non-standard/Custom"
}

def get_risk_level(score: float) -> str:
    """Classify 0-100 score into investigative risk categories."""
    if score >= 75:
        return "CRITICAL"
    elif score >= 50:
        return "HIGH"
    elif score >= 25:
        return "MEDIUM"
    return "LOW"
