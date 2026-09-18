# V.E.C.T.O.R-BITCOIN: Technical Write-Up
## AI-Powered Monitoring & Analysis of Bitcoin Transaction Traffic

**System:** V.E.C.T.O.R (Velocity-Enhanced Clustering and Transactional Outlier Recognition)  
**Domain:** Bitcoin Transaction Intelligence for Law Enforcement  
**Platform:** Offline Linux (WSL Fedora) — No external API dependencies  

---

## 1. System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        V.E.C.T.O.R SYSTEM                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│  │ Data Sources  │    │  Ingestion   │    │   Feature Engine     │   │
│  │              │───►│  Engine      │───►│                      │   │
│  │ CSV/JSON/XML │    │ bulk_ingest  │    │ 50+ behavioral       │   │
│  │ Bitcoin RPC  │    │ .py          │    │ features across      │   │
│  │ Redis Stream │    │              │    │ 9 groups             │   │
│  └──────────────┘    └──────────────┘    └───────┬──────────────┘   │
│                                                   │                  │
│  ┌──────────────┐    ┌──────────────┐    ┌───────▼──────────────┐   │
│  │ Transaction  │    │  Entity      │    │   ML Pipeline        │   │
│  │ Graph        │◄──►│  Profiler    │    │                      │   │
│  │ (NetworkX)   │    │ Common-Input │    │ UMAP → HDBSCAN →    │   │
│  │              │    │ Heuristic    │    │ IsolationForest +    │   │
│  │ PageRank,    │    │              │    │ XGBoost Fallback     │   │
│  │ Betweenness  │    └──────────────┘    └───────┬──────────────┘   │
│  └──────┬───────┘                                │                  │
│         │            ┌──────────────┐    ┌───────▼──────────────┐   │
│         │            │  IP-Wallet   │    │   Risk Engine        │   │
│         └───────────►│  Correlator  │───►│   6-Component        │   │
│                      │  GeoIP, Tor  │    │   Weighted Composite │   │
│                      │  Detection   │    │   + Label Spreading  │   │
│                      └──────────────┘    └───────┬──────────────┘   │
│                                                   │                  │
│  ┌──────────────┐    ┌──────────────────┐ ┌──────▼──────────────┐   │
│  │ MongoDB      │◄───│ Investigation    │◄│   Alert Generator   │   │
│  │ Persistence  │    │ Engine           │ │   Ranked + Explained│   │
│  └──────┬───────┘    │ Graph Crawl,     │ └─────────────────────┘   │
│         │            │ Flow Analysis,   │                            │
│         │            │ Lead Ranking     │                            │
│         │            └──────────────────┘                            │
│  ┌──────▼───────────────────────────────────────────────────────┐   │
│  │              React + TypeScript Dashboard                     │   │
│  │  Overview ∙ Live Feed ∙ Transaction Explorer ∙ Risk Queue    │   │
│  │  Entity Profiles ∙ Graph Explorer ∙ Behavioral Clusters      │   │
│  │  Anomaly Timeline ∙ Investigation Manager                    │   │
│  │  Wallet Intelligence                                          │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Ingestion

### 2.1 Dataset Schema
The system ingests bulk metadata conforming to the following schema:

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | datetime | Transaction relay time |
| `src_ip` / `dst_ip` | IPv4 | P2P relay source/destination |
| `src_port` / `dst_port` | int | Network ports (typically 8333) |
| `txid` | hex string | Transaction hash |
| `input_addresses[]` | string[] | Spending wallet addresses |
| `output_addresses[]` | string[] | Receiving wallet addresses |
| `input_amounts[]` / `output_amounts[]` | float[] | BTC values |
| `fee` | float | Transaction fee (BTC) |
| `input_count` / `output_count` | int | UTXO counts |
| `geo_country` | ISO 3166 | GeoIP country of relay node |
| `asn` | string | Autonomous System Number |

### 2.2 Supported Formats
- **CSV**: Semicolon-delimited list fields, DictReader parsing
- **JSON**: Flat array or `{"transactions": [...]}` envelope
- **XML**: `<transaction>` elements with nested `<item>` lists

### 2.3 Ingestion Pipeline
The `BulkIngestEngine` (`bulk_ingest.py`) orchestrates the complete processing pipeline for each ingested dataset:

```
Parse (CSV/JSON/XML)
      │
      ▼
Normalize to internal schema
      │
      ▼
Entity Profiler (Common-Input-Ownership heuristic)
      │
      ▼
Transaction Graph construction (NetworkX / pure-Python fallback)
      │
      ▼
Feature Extraction (50+ features, 9 groups)
      │
      ▼
Rules Engine (pattern detection, scored signals)
      │
      ▼
6-Component Risk Scoring
      │
      ▼
IP-Wallet Correlation (GeoIP, Tor, VPN detection)
      │
      ▼
Risk Propagation (Label Spreading, α=0.65)
      │
      ▼
Investigation Trigger evaluation
      │  (risk ≥ 70, multi-signal, propagated risk, severe patterns)
      │
      ├─── If triggered → InvestigationEngine (graph crawl + flow + leads)
      │
      ▼
Persist to MongoDB (transactions, entities, risk_events, investigations)
```

### 2.4 Synthetic Dataset Generator
`generate_dataset.py` produces realistic synthetic data embedding:
- **Normal** transactions (55%): 1-in, 2-out standard transfers
- **Peel chains** (12%): Multi-hop asymmetric change splits
- **CoinJoin** (10%): Many inputs, many equal-value outputs
- **Fan-in** (8%): Consolidation to single output
- **Fan-out** (8%): Dispersion to many outputs
- **Rapid forwarding** (7%): Sub-minute pass-through

Each transaction includes bundled GeoIP data, with 3 entity archetypes (normal/suspicious/illicit) and Tor exit node simulation for illicit entities.

---

## 3. AI/ML Pipeline

### 3.1 Model Architecture Choice

| Component | Algorithm | Rationale |
|-----------|-----------|-----------|
| **Dimensionality Reduction** | UMAP | Preserves local + global structure; robust to noise; ideal for high-dimensional behavioral vectors |
| **Behavioral Clustering** | HDBSCAN | Density-based; automatically determines cluster count; handles arbitrary shapes; noise-tolerant |
| **Anomaly Detection** | Isolation Forest (per-cluster) | Efficient for high-dimensional data; does not assume distribution shape; interpretable anomaly score |
| **Fallback Classifier** | XGBoost | Handles cold-start entities outside any cluster; gradient boosting with strong generalization; outputs calibrated probabilities |

### 3.2 Feature Engineering (50+ Features)

Features are organized into **9 groups** computed by `BitcoinFeatureEngine`:

| Group | Count | Examples |
|-------|-------|---------|
| Transaction Structural | 8 | `input_count`, `output_count`, `fee_btc`, `total_output_btc`, `weight` |
| Script Type Indicators | 5 | `has_p2pkh`, `has_p2sh`, `has_p2wpkh`, `has_p2wsh`, `has_p2tr` |
| UTXO Lifecycle | 5 | `avg_utxo_age_blocks`, `young_utxo_spending_ratio`, `utxo_fragmentation` |
| Entity Behavioral | 6 | `entity_tx_count`, `entity_total_received_btc`, `entity_velocity_1h` |
| Graph Centrality | 6 | `pagerank`, `betweenness_centrality`, `degree`, `clustering_coefficient` |
| Motif/Pattern | 6 | `is_peel_chain`, `is_fan_in`, `is_fan_out`, `coinjoin_score`, `mixing_score` |
| Temporal | 4 | `hour_of_day`, `day_of_week`, `tx_rate_1h`, `inter_tx_gap_seconds` |
| Value Distribution | 5 | `output_value_entropy`, `max_output_ratio`, `change_output_ratio` |
| Network/IP | 5 | `ip_reuse_count`, `geo_diversity`, `tor_flag`, `vpn_flag`, `anonymity_score` |

### 3.3 Training Pipeline

```
Raw Transactions
      │
      ▼
┌─────────────┐
│  Feature     │  50+ canonical features per entity
│  Extraction  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  StandardScaler  │  Zero-mean, unit-variance normalization
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  UMAP       │  n_components=8, min_dist=0.1, n_neighbors=15
│  Embedding  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  HDBSCAN    │  min_cluster_size=10, min_samples=5
│  Clustering │  → K behavioral communities
└──────┬──────┘
       │
       ├──────────────────────┐
       ▼                      ▼
┌─────────────┐        ┌─────────────┐
│ Per-Cluster  │        │  Global     │
│ Isolation    │        │  XGBoost    │
│ Forest       │        │  Fallback   │
│ (K models)   │        │  Classifier │
└──────────────┘        └─────────────┘
```

---

## 4. Detection Use Cases

### 4.1 Pattern Detection via Heuristic Rules

| Pattern | Detection Method | Rule Score Contribution |
|---------|-----------------|------------------------|
| **Peel Chain** | 1-in, 2-out with asymmetric split (small/large ratio < 0.15) | +35 |
| **CoinJoin** | ≥3 inputs, ≥3 equal-value outputs (equality ratio ≥ 0.4) | +30 to +40 |
| **Fan-In** | ≥5 inputs → ≤2 outputs (consolidation) | +25 |
| **Fan-Out** | ≤2 inputs → ≥8 outputs (dispersion) | +25 |
| **Rapid Forwarding** | Young UTXO spending ratio > 0.8 | +30 |
| **Dormant Awakening** | UTXO age > 1000 blocks spent suddenly | +20 |
| **Tor Exit Node** | Source IP matches known Tor prefix | +20 |
| **VPN/Hosting** | ASN matches known VPN provider | +10 |

### 4.2 CoinJoin Detection Algorithm
```
For transaction T with inputs I[] and outputs O[]:
  1. Filter out OP_RETURN outputs
  2. Round output values to 4 decimal places
  3. Count frequency of each output value
  4. max_equal = max(frequency of any single value)
  5. equal_ratio = max_equal / |O|
  6. IF max_equal ≥ 3 AND equal_ratio ≥ 0.4:
       → Flag as CoinJoin
       → coinjoin_score = min(1.0, equal_ratio × max_equal / 5)
```

### 4.3 Risk Propagation (Label Spreading)

Risk flows from **seed illicit entities** through the transaction graph:

```
risk(v) = max(risk(v), α × max(risk(neighbors)))
```

Where `α = 0.65` (decay factor per hop). This means:
- Hop 0 (seed): risk = 1.00
- Hop 1: risk ≤ 0.65
- Hop 2: risk ≤ 0.42
- Hop 3: risk ≤ 0.27

Propagation terminates when `max_change < 0.001` or after 10 iterations.

---

## 5. Multi-Model Risk Scoring

The **BitcoinRiskEngine** synthesizes six independent signal components into a composite risk score:

```
final_risk = w₁×ML + w₂×Graph + w₃×Velocity + w₄×Temporal + w₅×UTXO + w₆×Rules
```

| Component | Weight | Source |
|-----------|--------|--------|
| ML Score | 0.30 | Isolation Forest / XGBoost anomaly probability (0-1 → 0-100) |
| Graph Score | 0.20 | PageRank × 5000 + degree × 3 (capped at 100) |
| Velocity Score | 0.15 | tx_velocity_1h × 15 + velocity_deviation × 10 |
| Temporal Score | 0.10 | burst_frequency × 50 + sudden_activity_score × 50 |
| UTXO Score | 0.10 | old_utxo_spending_ratio × 40 + young_utxo_spending_ratio × 40 |
| Rule Score | 0.15 | Heuristic pattern detection (0-100 from signal accumulation) |

### Risk Level Classification

| Score Range | Level | Action |
|-------------|-------|--------|
| 75–100 | CRITICAL | Immediate investigation, auto-escalate |
| 50–74 | HIGH | Priority review, queue for analyst |
| 25–49 | MEDIUM | Monitoring, periodic review |
| 0–24 | LOW | Standard baseline, no action |

---

## 6. Automated Investigation Engine

### 6.1 Investigation Trigger

The **InvestigationTrigger** evaluates risk output against four criteria to decide whether to launch an automatic investigation:

| Criterion | Condition |
|-----------|-----------|
| **Composite Risk** | `risk_score ≥ 70` (configurable threshold) |
| **Multi-Signal Elevation** | ≥ 3 independent signals elevated above their thresholds (ML ≥ 60, Graph ≥ 50, Velocity ≥ 50, Temporal ≥ 40, UTXO ≥ 40, Rules ≥ 40) |
| **Propagated Risk** | `propagated_risk ≥ 0.5` from illicit seed entity |
| **Severe Pattern Combination** | ≥ 2 patterns from: peel_chain, coinjoin, mixing, rapid_forwarding, dormant_awakening, tor_exit_node |

### 6.2 Investigation Pipeline (8 Phases)

```
DETECT → INVESTIGATE → TRACE → PRIORITIZE → EXPLAIN
```

| Phase | Description |
|-------|-------------|
| **1. Seed Analysis** | Profile the seed entity: risk components, detected patterns, transaction history |
| **2. Adaptive Graph Crawl** | BFS traversal from seed entity through the transaction graph (max depth 3, max 100 entities). Prioritizes high-value and high-risk edges. |
| **3. Flow Analysis** | Track value flows through discovered subgraph. Identify significant flow paths (≥ 5% of seed volume). Detect rapid forwarding (< 600s inter-hop time). |
| **4. Role Assignment** | Classify each discovered entity into analytical roles: |
| | • **SOURCE** — Origin of suspicious funds |
| | • **INTERMEDIARY** — Pass-through with balanced in/out |
| | • **CONSOLIDATION** — Many-to-one aggregation (fan-in) |
| | • **LAYERING** — Rapid multi-hop forwarding |
| | • **DISPERSAL** — One-to-many distribution (fan-out) |
| | • **CONVERGENCE** — Multiple sources converging |
| | • **EXIT_CANDIDATE** — Terminal node, possible off-ramp |
| **5. Pattern Integration** | Apply rules engine to all discovered transactions and aggregate pattern signals |
| **6. Risk Propagation** | Run Label Spreading within the investigation subgraph |
| **7. Lead Ranking** | Score and prioritize entities by `lead_score = 0.4×risk + 0.2×flow_pct + 0.2×pattern_count + 0.1×connectivity + 0.1×propagated_risk`. Assign P1–P4 priority. |
| **8. Evidence Generation** | Produce structured evidence: graph nodes/edges, flow paths, timeline, role assignments, natural-language narrative |

### 6.3 Investigation Output Schema

```json
{
  "investigation_id": "INV-A1B2C3D4E5",
  "seed_entity_id": "ENT_BTC_042",
  "seed_transaction_id": "abc123...",
  "initial_risk_score": 82.5,
  "investigation_status": "COMPLETED",
  "investigation_depth": 3,
  "trigger_reasons": ["composite_risk_score_elevated (82.5 >= 70)", "multi_signal_elevation (...)"],
  "discovered_entities": ["ENT_BTC_042", "ENT_BTC_017", ...],
  "discovered_transactions": ["abc123...", "def456...", ...],
  "detected_patterns": [{"pattern": "peel_chain", "entity": "ENT_BTC_017", ...}],
  "flow_path": [{"from": "ENT_BTC_042", "to": "ENT_BTC_017", "btc": 1.5, ...}],
  "graph_nodes": [{"id": "ENT_BTC_042", "role": "SOURCE", "risk_score": 82.5, ...}],
  "graph_edges": [{"source": "ENT_BTC_042", "target": "ENT_BTC_017", ...}],
  "final_leads": [{"entity_id": "ENT_BTC_017", "lead_score": 76.3, "priority": "P1", ...}],
  "evidence": {"narrative": "...", "risk_decomposition": {...}, "timeline": [...]}
}
```

---

## 7. Explainability Method

V.E.C.T.O.R provides **signal-level decomposition** for every risk assessment:

### 7.1 Signal Decomposition
Each detection signal is named and scored independently:
```json
{
  "signals": ["peel_chain_pattern", "rapid_forwarding", "tor_exit_node", "velocity_spike"],
  "risk_components": {
    "ml_score": 72.0,
    "graph_score": 45.3,
    "velocity_score": 68.5,
    "temporal_score": 30.0,
    "utxo_score": 24.0,
    "rule_score": 65.0
  }
}
```

### 7.2 Natural Language Explanation
The risk engine generates human-readable explanations per signal:

> *"Strong ML behavioral anomaly detected (isolation_forest: score 0.72). High transaction velocity (8 tx/hr), exceeding baseline. Consecutive peel-chain structure identified with asymmetric change splits. Rapid transaction bursts occurring within short sub-minute intervals."*

### 7.3 Risk Propagation Path
For propagated risk, the system provides the exact path:
```
Seed: ENT_ILLICIT_001 → TX:abc123 → Addr:bc1q... → TX:def456 → Target Entity
```

### 7.4 Investigation-Level Evidence
Each investigation includes a structured evidence package with:
- Complete graph topology (nodes + edges with roles and risk scores)
- Value flow paths with BTC amounts and timing
- Pattern accumulation timeline
- Ranked lead list with per-lead justifications
- Natural-language investigation narrative

---

## 8. IP-Wallet Correlation

The **IPWalletCorrelator** module bridges network-layer and blockchain-layer observations:

| Feature | Description |
|---------|-------------|
| IP Reuse Count | How many wallets used the same relay IP |
| Geo Diversity | Number of distinct countries per entity |
| Tor Detection | Prefix-based detection of Tor exit nodes |
| VPN Detection | ASN-based detection of hosting/VPN providers |
| Cross-Entity IP Links | Entities sharing relay infrastructure |
| Burst Score | High-frequency transactions from single IP |
| Anonymity Score | Composite (Tor + VPN) / total IPs |

---

## 9. Frontend Dashboard

The React 18 + TypeScript 5 dashboard provides **12 navigable views** for analyst workflow:

| View | Description |
|------|-------------|
| **Overview** | System status metrics, risk distribution pie/bar charts, transaction volume timeline, pattern breakdown, GeoIP summary |
| **Live Feed** | Real-time transaction stream via Socket.io WebSocket push. Color-coded by risk level. |
| **Transaction Explorer** | Detailed single-transaction view: UTXO inputs/outputs, fee analysis, entity context, risk decomposition |
| **Entity Profiles** | Entity browser with search, risk scores, cluster assignments, address groupings, and entity-level transaction history |
| **Risk Queue** | Prioritized triage queue of flagged risk events. Analyst can escalate to investigation or dismiss. |
| **Graph Explorer** | Interactive force-directed transaction graph visualization. Nodes sized by risk, colored by type (address/transaction). |
| **Behavioral Clusters** | HDBSCAN cluster cards showing entity counts, average velocity, average volume, and per-cluster anomaly rates |
| **Anomaly Timeline** | Temporal view of anomalous activity patterns across all monitored entities |
| **Investigation Manager** | Investigation lifecycle: create, list, filter, and open investigation dossiers. Auto-created by investigation engine. |
| **Investigation Detail** | Full investigation view: graph visualization, flow path diagram, lead table, evidence panel, role assignment badges |
| **Wallet Intelligence** | Deep-dive wallet analysis with animated analysis progress, entity resolution, behavioral profiling, and risk decomposition |

### Key Interactive Features
- **Universal Search** — Multi-type search (transactions, entities, addresses, investigations) with type-aware result routing
- **Cross-View Navigation** — Click through from any entity/transaction to graph explorer, wallet intelligence, or investigation view
- **Real-Time Push** — Socket.io WebSocket for live transaction feed and risk event alerts
- **Dark/Light Theme** — System-wide theme toggle with CSS custom properties
- **Responsive Layout** — Mobile-through-desktop responsive grid layouts

---

## 10. API Architecture

### 10.1 Express.js REST API (port 3001)

| # | Route Group | Method | Endpoint | Description |
|---|-------------|--------|----------|-------------|
| 1 | Status | GET | `/api/bitcoin/status` | System status, block height, entity/TX counts, TPS, model latency |
| 2 | Blocks | GET | `/api/bitcoin/blocks` | Latest 20 blocks |
| 3 | Blocks | GET | `/api/bitcoin/blocks/:height` | Single block by height |
| 4 | Search | GET | `/api/bitcoin/search?q=` | Multi-type search (TX, entity, address, investigation) |
| 5 | Transactions | GET | `/api/bitcoin/transactions` | Latest transactions (limit param) |
| 6 | Transactions | GET | `/api/bitcoin/transactions/:txid` | Single TX with entity context enrichment |
| 7 | Entities | GET | `/api/bitcoin/entities` | All entities sorted by risk |
| 8 | Entities | GET | `/api/bitcoin/entity/:entity_id` | Entity detail with risk components + TX history |
| 9 | Addresses | GET | `/api/bitcoin/address/:address` | Address TX history with balance computation |
| 10 | Wallet Analysis | POST | `/api/bitcoin/wallets/:address/analyze` | Deep wallet intelligence report |
| 11 | Graph | GET | `/api/bitcoin/graph/:node_id` | Transaction subgraph around a node |
| 12 | Risk Queue | GET | `/api/bitcoin/risk-queue` | Risk events sorted by score |
| 13 | Clusters | GET | `/api/bitcoin/clusters` | Behavioral cluster summaries |
| 14 | Investigations | GET | `/api/bitcoin/investigations` | Investigation list with summaries |
| 15 | Investigations | POST | `/api/bitcoin/investigations` | Create new manual investigation |
| 16 | Investigations | GET | `/api/bitcoin/investigations/:id` | Full investigation detail |
| 17 | Investigations | GET | `/api/bitcoin/investigations/:id/graph` | Investigation graph (nodes + edges) |
| 18 | Investigations | GET | `/api/bitcoin/investigations/:id/flow` | Investigation flow path + evidence |
| 19 | Investigations | GET | `/api/bitcoin/investigations/:id/leads` | Ranked investigation leads |
| 20 | Geo Analytics | GET | `/api/bitcoin/geo-stats` | Geographic distribution from IP correlation |
| 21 | IP Correlation | GET | `/api/bitcoin/ip-correlations` | IP-wallet correlation data |
| 22 | Risk Propagation | GET | `/api/bitcoin/risk-propagation` | Seed and propagated entity data |
| 23 | Bulk Ingestion | POST | `/api/bitcoin/ingest` | Ingest transaction batch via API |

### 10.2 Socket.io Real-Time Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `bitcoin:newTransaction` | Server → Client | New transaction processed |
| `bitcoin:newRiskEvent` | Server → Client | New risk event flagged |
| `newTransaction` | Server → Client | Financial domain transaction update |

---

## 11. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| ML/Data | Python, NumPy, Pandas, scikit-learn, XGBoost, UMAP, HDBSCAN, joblib | 3.11+ |
| Graph | NetworkX (with pure-Python fallback) | 3.x |
| Persistence | MongoDB | 6.0+ |
| Streaming | Redis Streams | 7.0+ |
| Backend API | Express.js, Socket.io | 4.x |
| Frontend | React 18, TypeScript 5, Chart.js, TailwindCSS 3, Framer Motion, Lucide React | Latest |
| Routing | react-router-dom | 7.x |
| HTTP Client | Axios | 1.x |
| Platform | Linux (WSL Fedora 44), fully offline | - |

---

## 12. Deployment

The system is fully offline and deploys with two scripts:

1. **`setup_fedora.sh`** — Installs MongoDB, Redis, Python 3.11+, Node.js 18+, creates virtual environment, installs all Python (`requirements.txt`) and Node (`package.json`) dependencies.
2. **`run.sh`** — 7-step automated launcher:
   1. Activate Python virtual environment
   2. Start MongoDB (systemctl or manual fallback)
   3. Start Redis (systemctl or manual fallback)
   4. Generate synthetic Bitcoin dataset (5,000 transactions, 6 pattern types, 3 entity archetypes)
   5. Run full bulk ingestion pipeline (Parse → Features → Rules → Risk → IP → Propagation → Investigation → Persist)
   6. Train ML models (StandardScaler → UMAP → HDBSCAN → per-cluster IsolationForest + XGBoost fallback)
   7. Start Express.js backend (port 3001) + Vite frontend (port 5173)

Access at `http://localhost:5173` after running `./run.sh`.

### MongoDB Collections

| Collection | Contents |
|------------|----------|
| `bitcoin_transactions` | Processed transactions with risk scores, signals, features |
| `bitcoin_entities` | Behavioral entities with risk scores, cluster assignments, detected patterns |
| `bitcoin_blocks` | Block metadata |
| `bitcoin_risk_events` | Flagged risk events for analyst triage |
| `bitcoin_investigations` | Investigation dossiers with graph, flow, leads, evidence |
| `bitcoin_ip_correlations` | IP-wallet correlation data |
| `fraud_transactions` | Financial domain: flagged transactions |
| `legit_transactions` | Financial domain: legitimate transactions |

---

*Document prepared for the National Technical Research Organisation (NTRO) problem statement on AI-Powered Monitoring & Analysis of Bitcoin Transaction Traffic.*
