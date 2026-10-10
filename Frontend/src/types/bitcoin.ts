export interface BitcoinInput {
  vin_index: number;
  prev_txid: string;
  prev_vout: number;
  value_btc: number;
  script_type: string;
  address?: string;
  is_coinbase?: boolean;
}

export interface BitcoinOutput {
  vout: number;
  value_btc: number;
  script_type: string;
  address?: string;
  is_op_return?: boolean;
}

export interface BitcoinTransaction {
  _id?: string;
  txid: string;
  block_height: number;
  block_hash: string;
  timestamp: number;
  date: string;
  time: string;
  version: number;
  size: number;
  vsize: number;
  weight: number;
  entity_id: string;
  input_count: number;
  output_count: number;
  total_input_btc: number;
  total_output_btc: number;
  fee_btc: number;
  inputs: BitcoinInput[];
  outputs: BitcoinOutput[];
  input_addresses: string[];
  output_addresses: string[];
  risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  signals: string[];
  explanation: string;
  cluster_id: number;
  status: string;
  amount?: number;
  amount_btc?: number;
}

export interface BitcoinBlock {
  _id?: string;
  height: number;
  hash: string;
  time: number;
  timestamp: string;
  tx_count: number;
  size: number;
  difficulty: number;
  status: string;
}

export interface BitcoinEntity {
  _id?: string;
  entity_id: string;
  label: string;
  primary_address: string;
  addresses: string[];
  first_seen: string;
  last_seen: string;
  tx_count: number;
  total_received_btc: number;
  total_sent_btc: number;
  balance_btc: number;
  velocity_1h: number;
  velocity_24h: number;
  unique_counterparties: number;
  cluster_id: number;
  cluster_description: string;
  risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  pagerank: number;
  address_count?: number;
  cross_entity_links?: number;
}

export interface BitcoinRiskLead {
  _id?: string;
  lead_id: string;
  txid: string;
  entity_id: string;
  risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  signals: string[];
  explanation: string;
  timestamp: number;
  created_at: string;
}

export interface BitcoinInvestigation {
  _id?: string;
  investigation_id: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';
  risk_score: number;
  created_by: string;
  created_at: string;
  entities: string[];
  transactions: string[];
  notes: string;
}

export interface BitcoinClusterInfo {
  cluster_id: number;
  name: string;
  description: string;
  entity_count: number;
  avg_volume_btc: number | null;
  avg_velocity_1h: number | null;
  anomaly_rate_pct: number | null;
}

export interface BitcoinStatus {
  dataset_mode?: 'SIMULATION' | 'MIXED' | 'IMPORTED_OR_LIVE_UNVERIFIED' | string;
  simulated_transaction_count?: number;
  current_block_height: number | null;
  total_blocks_processed: number;
  total_transactions: number;
  total_entities: number;
  total_btc_monitored: number;
  critical_leads_count: number;
  high_leads_count: number;
  network: string;
  node_status: 'CONNECTED' | 'DISCONNECTED' | 'SIMULATION' | 'DEGRADED' | string;
  model_status: 'OPERATIONAL' | 'MODEL_MISSING' | 'MODEL_LOADING' | 'MODEL_ERROR' | string;
  tps: number | null;
  model_latency_ms: number | null;
  unconfirmed_txs?: number | null;
  node?: {
    status: string;
    height: number | null;
    chain?: string | null;
    headers?: number | null;
    verificationprogress?: number | null;
    mempool_txs?: number | null;
    connections?: number;
    latency_ms?: number | null;
    error?: string | null;
  };
  model?: {
    status: string;
    name?: string;
    version?: string;
    loaded_at?: string | null;
    features_count?: number;
    clusters_loaded?: number[];
    fallback_model?: string | null;
    error?: string | null;
  };
  throughput?: {
    status: 'active' | 'idle' | string;
    tx_per_sec: number | null;
    last_batch_tps?: number | null;
    historical_avg_tps?: number | null;
    current_window_tps?: number | null;
    processed_transactions?: number;
    elapsed_seconds?: number | null;
    updated_at?: string;
  };
  inference?: {
    status: string;
    latency_ms: number | null;
    avg_latency_ms?: number | null;
    p95_latency_ms?: number | null;
    sample_count?: number;
    total_inferences?: number;
    breakdown?: {
      preprocessing_ms?: number;
      inference_ms?: number;
      postprocessing_ms?: number;
    } | null;
  };
  mempool?: {
    status: 'AVAILABLE' | 'UNAVAILABLE' | 'SIMULATION' | string;
    count: number | null;
    bytes?: number | null;
  };
  storage?: {
    total_blocks_processed: number;
    total_transactions: number;
    total_entities: number;
    total_btc_monitored: number;
    critical_leads_count: number;
    high_leads_count: number;
  };
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'address' | 'transaction' | 'entity';
  value_btc?: number;
  risk_score?: number;
  risk_level?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  edge_type: string;
  value_btc?: number;
}

// ===== Investigation Engine Types =====

export interface InvestigationSummary {
  investigation_id: string;
  seed_entity_id: string;
  seed_transaction_id: string;
  initial_risk_score: number;
  investigation_status: 'OPEN' | 'ANALYZING' | 'COMPLETED' | 'REVIEWED';
  investigation_depth: number;
  trigger_reasons: string[];
  created_at: string;
  discovered_entities_count: number;
  discovered_transactions_count: number;
  detected_patterns_count: number;
  leads_count: number;
  // Backward compat
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: string;
  risk_score: number;
  created_by: string;
  entities: string[];
  transactions: string[];
  notes: string;
  primary_entity?: string;
}

export interface InvestigationFlowStep {
  source_entity: string;
  destination_entity: string;
  via_address: string;
  transaction_id: string;
  amount: number;
  timestamp: number;
  hop: number;
  forwarding_ratio: number;
  cumulative_flow: number;
  pct_of_seed: number;
  expansion_reasons: string[];
}

export interface InvestigationPattern {
  pattern_type: string;
  involved_entities: string[];
  involved_transactions: string[];
  confidence: string;
  severity: number;
  evidence: string;
  hop: number;
  timestamp_range: { start: number; end: number };
}

export interface InvestigationLead {
  entity_id: string;
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  risk_label: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  composite_score: number;
  direct_risk: number;
  propagated_risk: number;
  role: string;
  reasons: string[];
  evidence_summary: {
    tx_count: number;
    connected_entities: number;
    detected_patterns: number;
    downstream_hops: number;
    total_flow_btc: number;
  };
}

export interface InvestigationGraphNode {
  id: string;
  label: string;
  type: string;
  role: string;
  risk_score: number;
  direct_risk: number;
  propagated_risk: number;
  tx_count: number;
  is_seed: boolean;
  investigation_relevance: number;
  hop?: number;
}

export interface InvestigationGraphEdge {
  source: string;
  target: string;
  transaction_id: string;
  amount: number;
  timestamp: number;
  hop: number;
  flow_percentage: number;
  pattern_association: string;
  edge_type: string;
}

export interface InvestigationEvidence {
  trigger: string[];
  flow_evidence: {
    seed_amount: number;
    downstream_amount: number;
    hop_count: number;
    forwarding_ratio: number;
    total_flow_steps: number;
  };
  patterns: string[];
  entity_evidence: {
    total_discovered: number;
    total_transactions: number;
    total_leads: number;
    highest_lead_score: number;
  };
  risk_propagation: {
    seed_entity: string;
    propagation_depth: number;
  };
}

export interface InvestigationFull {
  investigation_id: string;
  seed_transaction_id: string;
  seed_entity_id: string;
  initial_risk_score: number;
  trigger_reasons: string[];
  created_at: string;
  investigation_status: string;
  investigation_depth: number;
  discovered_entities: string[];
  discovered_transactions: string[];
  detected_patterns: InvestigationPattern[];
  evidence: InvestigationEvidence;
  final_leads: InvestigationLead[];
  seed_analysis: Record<string, unknown>;
  flow_path: InvestigationFlowStep[];
  graph_nodes: InvestigationGraphNode[];
  graph_edges: InvestigationGraphEdge[];
  risk_propagation_results: Record<string, unknown>;
  title?: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  status?: string;
  risk_score?: number;
  created_by?: string;
  primary_entity?: string;
  patterns?: InvestigationPattern[];
}

export interface SearchResult {
  type: 'auto' | 'address' | 'txid' | 'entity' | 'wallet' | 'transaction' | 'investigation';
  id: string;
  label: string;
  subLabel?: string;
  risk?: string;
}

export interface WalletOutlierLead {
  lead_id?: string;
  entity_id?: string;
  pattern?: string;
  explanation?: string;
  signals?: string[];
  risk_score?: number;
  txid?: string;
}

export interface WalletAnalysis {
  query_input?: string;
  is_known?: boolean;
  message?: string;
  address: string;
  entity: {
    entity_id: string;
    primary_address: string;
    address_count: number;
    cluster_id: number | null;
    anonymity_score: number | null;
    first_seen: string | number | null;
    last_seen: string | number | null;
  };
  behavior: {
    velocity_1h: number | null;
    velocity_24h: number | null;
    total_volume_btc: number | null;
    avg_tx_value: number | null;
    counterparty_diversity: number | null;
  };
  cluster?: {
    cluster_id: number | null;
    name: string | null;
    archetype: string | null;
    avg_volume_btc: number | null;
    anomaly_percentage: number | null;
    description: string | null;
  };
  risk: {
    score: number | null;
    level: string;
    is_seed_illicit: boolean;
    propagated_risk: number;
    components: {
      ml_anomaly: number | null;
      graph_risk: number | null;
      velocity_signal: number | null;
    };
  };
  transactions: BitcoinTransaction[];
  graph?: {
    nodes: Array<{ id: string; label: string; type: string; risk: number; cluster_id?: number }>;
    edges: Array<{ from: string; to: string; value: number; txid: string }>;
    stats?: { total_neighbors: number; in_degree: number; out_degree: number };
  };
  patterns: string[];
  investigation?: {
    active: boolean;
    id: string | null;
    status: string | null;
    priority: string | null;
    leads_count: number;
  };
  leads?: WalletOutlierLead[];
  investigation_recommended: boolean;
  analyzed_at?: string;
}
