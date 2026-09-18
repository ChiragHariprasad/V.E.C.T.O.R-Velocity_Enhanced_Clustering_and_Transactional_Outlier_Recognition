# V.E.C.T.O.R — HARDCODED DATA AUDIT (v2)

> **Audit Date**: 2026-09-18/19
> **Scope**: Identification of hardcoded, static, or placeholder data across the system.

## 1. Frontend (React UI) Hardcoded Values

| Component/File | Location | Hardcoded Value / Fallback | Impact |
|---|---|---|---|
| `BitcoinOverview.tsx` | Line 96 | `'ENT_22E730C8B03C'` | Fallback entity ID if no active investigation or risk queue item exists. |
| `BitcoinOverview.tsx` | Line 98 | `61.2` | Fallback risk score if no active investigation or entity data exists. |
| `BitcoinOverview.tsx` | Lines 202-210 | `['ENT_22E730C8', ...]` & `[21.0, 14.5, ...]` | Default entity labels and velocity data used if less than 3 entities are loaded from the database. |
| `BitcoinOverview.tsx` | Line 685 | `"14.2% Anomaly"` | Hardcoded text badge on the Behavioral Cluster Analysis card. Does not reflect actual cluster anomaly rate. |
| `BitcoinInvestigationView.tsx` | Line 231 | `'High-Velocity Mixer Community'` | Fallback archetype displayed if the cluster lacks an archetype definition. |
| `BitcoinInvestigationView.tsx` | Lines 439-443 | `[{pattern_type: 'Peel Chain...'}, ...]` | 4 hardcoded behavioral signatures shown if the investigation has no patterns attached. |
| `BitcoinTransactionGraph.tsx` | Line 24 | `'ENT_BTC_001'` | Fallback target node ID for the graph visualization if no entities exist. |
| `BitcoinContext.tsx` | Lines 179-181 | `'INV-35C54D881B'` | Automatically attempts to hydrate this specific primary investigation ID on load. |

## 2. Backend (Express Server) Hardcoded Values

| Route/File | Location | Hardcoded Value / Fallback | Impact |
|---|---|---|---|
| `index.js` (Status Endpoint) | Lines 348-349 | `last_batch_tps: 8.42`, `historical_avg_tps: 8.42` | The status endpoint proxies real Python data, but overwrites the TPS with these static values if transactions exist. |
| `index.js` (Wallet Analysis) | Line 667 | `'High-Velocity Mixer' / 'Exchange Hub' / 'OTC / Layering Node'` | Hardcoded cluster archetypes used as fallbacks if the database lacks cluster profile metadata. |
| `index.js` (Wallet Analysis) | Line 668 | `avg_volume_btc: 24.5` | Fake average cluster volume fallback. |
| `index.js` (Wallet Analysis) | Line 669 | `anomaly_percentage: 14.2` | Fake cluster anomaly rate fallback. |
| `index.js` (Wallet Analysis) | Line 750 | `anonymity_score: 0.15` | Fallback score for entity anonymity. |
| `index.js` (Wallet Analysis) | Lines 768-770 | `ml_anomaly: 0.45 * score`, `graph_risk: 0.35 * score`, `velocity_signal: 0.2 * score` | Risk components are estimated mathematically from the total score, rather than pulling the actual breakdown from the ML/rules engine. |
| `index.js` (Wallet Analysis) | Lines 778-780 | `['high_velocity_flow', 'multi_input_aggregation']` | Default patterns shown if the entity document lacks detected patterns. |
| `index.js` (Geo Stats) | Lines 1188-1200 | Static JSON array of 10 countries (US, DE, RU, CN, etc.) | Demo fallback data used only if the `bitcoin_ip_correlations` collection is empty. Currently bypassed because real geo data is populated. |

## 3. Backend (Python Pipeline) Static Features

The feature engineering module (`bitcoin_features.py`) calculates the majority of its 66 features mathematically from the graph, UTXOs, and transaction properties. However, 5 specific behavioral/temporal features are currently hardcoded placeholders.

| Feature Name | Static Value | Description |
|---|---|---|
| `activity_periodicity` | `0.5` | Needs to be computed via periodogram of transaction timestamps. |
| `counterparty_concentration` | `0.45` | Needs to be computed via Herfindahl index of flow amounts. |
| `repeated_counterparty_ratio` | `0.2` | Needs repeat-interaction analysis across history. |
| `counterparty_deviation` | `0.15` | Needs baseline comparison. |
| `temporal_deviation` | `0.20` | Needs baseline comparison. |

## 4. Test Script Artifacts

The `test_ml_pipeline.py` script revealed that the rule evaluation method was called `evaluate_heuristics()`, but the test script expected `evaluate()`. This is a test script bug, not a hardcoded system bug, as the main `bulk_ingest.py` correctly uses `evaluate_heuristics()`.

## Summary
The system has successfully transitioned away from major hardcoded ML scores (ML models are now operational). The remaining hardcoded values are primarily UI fallbacks and specific feature placeholders that do not break the core end-to-end functionality, but reduce the accuracy of specific UI components (like TPS and Wallet Analysis breakdown).
