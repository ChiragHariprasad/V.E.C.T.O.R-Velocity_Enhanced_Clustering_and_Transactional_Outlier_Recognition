# V.E.C.T.O.R — API TEST RESULTS (v2)

> **Test Date**: 2026-09-18/19
> **Method**: All endpoints tested via Python urllib against live backend at http://localhost:3001

## Summary: 28/30 PASS

## Phase 1: Core Status
```
PASS | Status                              | HTTP 200 |   101.1ms | object(19 keys)
     Node: DISCONNECTED, Model: OPERATIONAL, Network: unknown
     Transactions: 5006, Entities: 981
     TPS: 0, ML Latency: 6.112ms
     Throughput.last_batch_tps: 8.42 [HARDCODED], historical_avg_tps: 8.42 [HARDCODED]
     Inference.status: measured, latency_ms: 6.112, avg: 109.085
```

## Phase 2: Data Endpoints
```
PASS | Transactions (limit=5)              | HTTP 200 |    35.5ms | array[5]
PASS | Blocks                              | HTTP 200 |    25.1ms | array[1]
PASS | Entities                            | HTTP 200 |    51.7ms | array[981]
PASS | Risk Queue                          | HTTP 200 |   158.3ms | array[4491]
PASS | Clusters                            | HTTP 200 |    24.8ms | array[3]
PASS | Investigations                      | HTTP 200 | 13023.7ms | array[700]  [SLOW!]
PASS | Geo Stats                           | HTTP 200 |     6.6ms | array[15]
PASS | Risk Propagation                    | HTTP 200 |    62.8ms | object(4 keys)
PASS | IP Correlations                     | HTTP 200 |    64.0ms | object(4 keys)
```

## Phase 3: Resource Lookup
```
PASS | Transaction by TXID                 | HTTP 200 |    29.3ms | object(20 keys)
PASS | Entity by ID                        | HTTP 200 |     9.1ms | object(2 keys)
PASS | Graph by Entity                     | HTTP 200 |     6.8ms | object(2 keys)
PASS | Investigation Detail                | HTTP 200 |     4.6ms | object(26 keys)
PASS | Investigation Graph                 | HTTP 200 |     3.2ms | object(4 keys)
PASS | Investigation Flow                  | HTTP 200 |     3.7ms | object(4 keys)
PASS | Investigation Leads                 | HTTP 200 |     3.7ms | object(4 keys)
```

## Phase 4: Search
```
PASS | Search by Entity ID                 | HTTP 200 |   201.5ms | array[3]
PASS | Search by TXID                      | HTTP 200 |    13.0ms | array[1]
PASS | Search empty                        | HTTP 200 |     3.1ms | array[0]
PASS | Search invalid                      | HTTP 200 |    27.9ms | array[0]
```

## Phase 5: Wallet Analysis
```
PASS | Wallet Analysis (entity)            | HTTP 200 |   192.6ms | object(15 keys)
     is_known: True, entity: ENT_01224F550305
     Risk: score=76.35, level=MEDIUM
     Patterns: ['high_velocity_flow', 'multi_input_aggregation']
     Investigation: active=True, recommended=True
PASS | Wallet Analysis (invalid)           | HTTP 400 |    18.4ms | Correct rejection
PASS | Wallet Analysis (unknown valid)     | HTTP 200 |    16.1ms | object(15 keys)
```

## Phase 6: Error Handling
```
PASS | Transaction not found               | HTTP 404 |    19.8ms
PASS | Entity not found                    | HTTP 404 |     4.8ms
PASS | Investigation not found             | HTTP 404 |    24.6ms
PASS | Block not found                     | HTTP 404 |     4.4ms
```

## Phase 7: Ingest Endpoint
```
PASS | Ingest (POST)                       | HTTP 201 |    34.8ms | Ingested: 1
FAIL | Ingest (empty body)                 | HTTP 404 |    23.1ms | Should be 400
```

## Issues Found

1. Investigations endpoint takes 13 seconds (no pagination)
2. Ingest with empty body returns 404 instead of 400
3. throughput.last_batch_tps and historical_avg_tps are hardcoded to 8.42
