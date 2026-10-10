import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { socket } from '../socket';
import {
  BitcoinTransaction,
  BitcoinBlock,
  BitcoinEntity,
  BitcoinRiskLead,
  BitcoinInvestigation,
  BitcoinClusterInfo,
  BitcoinStatus,
  GraphNode,
  GraphEdge,
  InvestigationSummary,
  InvestigationFull,
  InvestigationGraphNode,
  InvestigationGraphEdge,
  InvestigationFlowStep,
  InvestigationLead,
  SearchResult,
  WalletAnalysis
} from '../types/bitcoin';

const BASE_URL = import.meta.env.VITE_API_BASE_URL !== undefined
  ? import.meta.env.VITE_API_BASE_URL
  : (typeof window !== 'undefined' && window.location.port === '5173' ? 'http://localhost:3001' : '');
const API_BASE = `${BASE_URL}/api/bitcoin`;

interface BitcoinContextType {
  status: BitcoinStatus | null;
  transactions: BitcoinTransaction[];
  blocks: BitcoinBlock[];
  entities: BitcoinEntity[];
  riskQueue: BitcoinRiskLead[];
  clusters: BitcoinClusterInfo[];
  investigations: InvestigationSummary[];
  selectedTx: BitcoinTransaction | null;
  setSelectedTx: (tx: BitcoinTransaction | null) => void;
  selectedEntity: BitcoinEntity | null;
  setSelectedEntity: (entity: BitcoinEntity | null) => void;
  graphData: { nodes: GraphNode[]; edges: GraphEdge[] };
  fetchGraph: (nodeId: string) => Promise<void>;
  createInvestigation: (data: Partial<BitcoinInvestigation>) => Promise<void>;
  refreshAll: () => Promise<void>;
  isLoading: boolean;
  // Investigation Engine
  activeInvestigation: InvestigationFull | null;
  investigationGraph: { nodes: InvestigationGraphNode[]; edges: InvestigationGraphEdge[] };
  investigationFlow: InvestigationFlowStep[];
  investigationLeads: InvestigationLead[];
  fetchInvestigation: (id: string) => Promise<void>;
  fetchInvestigationGraph: (id: string) => Promise<void>;
  fetchInvestigationFlow: (id: string) => Promise<void>;
  fetchInvestigationLeads: (id: string) => Promise<void>;
  startInvestigation: (seed_entity_id?: string, seed_txid?: string) => Promise<void>;
  // Global Search & Wallet Intel
  search: (query: string) => Promise<SearchResult[]>;
  analyzeWallet: (address: string) => Promise<WalletAnalysis | null>;
}

const defaultStatus: BitcoinStatus = {
  current_block_height: null,
  total_blocks_processed: 0,
  total_transactions: 0,
  total_entities: 0,
  total_btc_monitored: 0,
  critical_leads_count: 0,
  high_leads_count: 0,
  network: 'unknown',
  node_status: 'DISCONNECTED',
  model_status: 'MODEL_LOADING',
  tps: null,
  model_latency_ms: null,
  unconfirmed_txs: null,
  node: {
    status: 'DISCONNECTED',
    height: null,
    chain: null,
    mempool_txs: null,
    connections: 0,
    latency_ms: null,
    error: null
  },
  model: {
    status: 'MODEL_LOADING',
    name: 'V.E.C.T.O.R Multi-Model Behavioral Anomaly Detector',
    version: 'bitcoin_v1'
  },
  throughput: {
    status: 'idle',
    tx_per_sec: 0.0
  },
  inference: {
    status: 'unmeasured',
    latency_ms: null
  },
  mempool: {
    status: 'UNAVAILABLE',
    count: null
  }
};

const BitcoinContext = createContext<BitcoinContextType>({
  status: defaultStatus,
  transactions: [],
  blocks: [],
  entities: [],
  riskQueue: [],
  clusters: [],
  investigations: [],
  selectedTx: null,
  setSelectedTx: () => {},
  selectedEntity: null,
  setSelectedEntity: () => {},
  graphData: { nodes: [], edges: [] },
  fetchGraph: async () => {},
  createInvestigation: async () => {},
  refreshAll: async () => {},
  isLoading: true,
  // Investigation Engine
  activeInvestigation: null,
  investigationGraph: { nodes: [], edges: [] },
  investigationFlow: [],
  investigationLeads: [],
  fetchInvestigation: async () => {},
  fetchInvestigationGraph: async () => {},
  fetchInvestigationFlow: async () => {},
  fetchInvestigationLeads: async () => {},
  startInvestigation: async () => {},
  search: async () => [],
  analyzeWallet: async () => null,
});

export const useBitcoin = () => useContext(BitcoinContext);

export const BitcoinProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<BitcoinStatus | null>(defaultStatus);
  const [transactions, setTransactions] = useState<BitcoinTransaction[]>([]);
  const [blocks, setBlocks] = useState<BitcoinBlock[]>([]);
  const [entities, setEntities] = useState<BitcoinEntity[]>([]);
  const [riskQueue, setRiskQueue] = useState<BitcoinRiskLead[]>([]);
  const [clusters, setClusters] = useState<BitcoinClusterInfo[]>([]);
  const [investigations, setInvestigations] = useState<InvestigationSummary[]>([]);
  const [selectedTx, setSelectedTx] = useState<BitcoinTransaction | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<BitcoinEntity | null>(null);
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });
  const [isLoading, setIsLoading] = useState(true);
  // Investigation Engine state
  const [activeInvestigation, setActiveInvestigation] = useState<InvestigationFull | null>(null);
  const [investigationGraph, setInvestigationGraph] = useState<{ nodes: InvestigationGraphNode[]; edges: InvestigationGraphEdge[] }>({ nodes: [], edges: [] });
  const [investigationFlow, setInvestigationFlow] = useState<InvestigationFlowStep[]>([]);
  const [investigationLeads, setInvestigationLeads] = useState<InvestigationLead[]>([]);

  const refreshAll = async () => {
    try {
      const [resStatus, resTxs, resBlocks, resEntities, resRisk, resClusters, resInvs] = await Promise.all([
        axios.get(`${API_BASE}/status`).catch(() => ({ data: defaultStatus })),
        axios.get(`${API_BASE}/transactions?limit=60`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/blocks`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/entities`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/risk-queue`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/clusters`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/investigations`).catch(() => ({ data: [] }))
      ]);

      setStatus(resStatus.data);
      setTransactions(resTxs.data);
      setBlocks(resBlocks.data);
      setEntities(resEntities.data);
      setRiskQueue(resRisk.data);
      setClusters(resClusters.data);
      setInvestigations(resInvs.data);

      if (resTxs.data.length > 0 && !selectedTx) {
        setSelectedTx(resTxs.data[0]);
      }
      if (resEntities.data.length > 0 && !selectedEntity) {
        setSelectedEntity(resEntities.data[0]);
      }

      // Automatically hydrate primary investigation flow & graph from the latest real investigation
      const primaryInvId = resInvs.data[0]?.investigation_id;
      if (primaryInvId) {
        fetchInvestigation(primaryInvId);
        fetchInvestigationFlow(primaryInvId);
        fetchInvestigationGraph(primaryInvId);
        fetchInvestigationLeads(primaryInvId);
      }
      setIsLoading(false);
    } catch (e) {
      console.error('Error fetching Bitcoin data:', e);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();

    // Socket.io real-time updates with deduplication
    const handleNewTx = (tx: BitcoinTransaction) => {
      setTransactions(prev => {
        if (!tx || !tx.txid) return prev;
        if (prev.some(t => t.txid === tx.txid)) return prev;
        return [tx, ...prev.slice(0, 79)];
      });
    };

    const handleNewBlock = (block: BitcoinBlock) => {
      setBlocks(prev => {
        if (!block) return prev;
        if (prev.some(b => b.hash === block.hash || (b.height !== null && b.height === block.height))) return prev;
        return [block, ...prev.slice(0, 19)];
      });
    };

    const handleNewRisk = (lead: BitcoinRiskLead) => {
      setRiskQueue(prev => {
        if (!lead) return prev;
        if (prev.some(l => (lead.txid && l.txid === lead.txid) || (lead.lead_id && l.lead_id === lead.lead_id))) return prev;
        return [lead, ...prev];
      });
    };

    socket.on('bitcoin:newTransaction', handleNewTx);
    socket.on('bitcoin:newBlock', handleNewBlock);
    socket.on('bitcoin:newRiskEvent', handleNewRisk);
    socket.on('bitcoin:newAlert', handleNewRisk);

    return () => {
      socket.off('bitcoin:newTransaction', handleNewTx);
      socket.off('bitcoin:newBlock', handleNewBlock);
      socket.off('bitcoin:newRiskEvent', handleNewRisk);
      socket.off('bitcoin:newAlert', handleNewRisk);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchGraph = async (nodeId: string) => {
    try {
      const res = await axios.get(`${API_BASE}/graph/${nodeId}`);
      setGraphData(res.data);
    } catch (e) {
      console.error('Error loading graph:', e);
    }
  };

  const createInvestigation = async (data: Partial<BitcoinInvestigation>) => {
    try {
      const res = await axios.post(`${API_BASE}/investigations`, data);
      setInvestigations(prev => [res.data, ...prev]);
    } catch (e) {
      console.error('Failed to create investigation:', e);
    }
  };

  // Investigation Engine methods
  const fetchInvestigation = async (id: string) => {
    try {
      const res = await axios.get(`${API_BASE}/investigations/${id}`);
      setActiveInvestigation(res.data);
    } catch (e) {
      console.error('Error loading investigation:', e);
    }
  };

  const fetchInvestigationGraph = async (id: string) => {
    try {
      const res = await axios.get(`${API_BASE}/investigations/${id}/graph`);
      setInvestigationGraph(res.data);
    } catch (e) {
      console.error('Error loading investigation graph:', e);
    }
  };

  const fetchInvestigationFlow = async (id: string) => {
    try {
      const res = await axios.get(`${API_BASE}/investigations/${id}/flow`);
      setInvestigationFlow(res.data.flow_path || []);
    } catch (e) {
      console.error('Error loading investigation flow:', e);
    }
  };

  const fetchInvestigationLeads = async (id: string) => {
    try {
      const res = await axios.get(`${API_BASE}/investigations/${id}/leads`);
      setInvestigationLeads(res.data.leads || []);
    } catch (e) {
      console.error('Error loading investigation leads:', e);
    }
  };

  const startInvestigation = async (seed_entity_id?: string, seed_txid?: string) => {
    try {
      const res = await axios.post(`${API_BASE}/investigations`, {
        title: `Auto Investigation: ${seed_entity_id || seed_txid}`,
        seed_entity_id,
        seed_txid,
        entities: seed_entity_id ? [seed_entity_id] : [],
        transactions: seed_txid ? [seed_txid] : [],
        trigger_reasons: ['manual_investigation_request'],
      });
      setInvestigations(prev => [res.data, ...prev]);
    } catch (e) {
      console.error('Failed to start investigation:', e);
    }
  };

  const search = async (query: string): Promise<SearchResult[]> => {
    try {
      const res = await axios.get(`${API_BASE}/search`, { params: { q: query } });
      return res.data;
    } catch (e) {
      console.error('Search failed:', e);
      return [];
    }
  };

  const analyzeWallet = async (address: string): Promise<WalletAnalysis | null> => {
    try {
      const res = await axios.post(`${API_BASE}/wallets/${encodeURIComponent(address)}/analyze`);
      return res.data;
    } catch (e: unknown) {
      if (axios.isAxiosError(e) && e.response && e.response.status === 400) {
        throw new Error((e.response.data as { error?: string })?.error || 'Invalid Bitcoin address or identifier format');
      }
      try {
        const fallback = await axios.get(`${API_BASE}/wallets/${encodeURIComponent(address)}/analyze`);
        return fallback.data;
      } catch (fallbackErr: unknown) {
        console.error('Wallet analysis failed:', fallbackErr);
        if (axios.isAxiosError(fallbackErr) && (fallbackErr.response?.data as { error?: string })?.error) {
          throw new Error((fallbackErr.response?.data as { error?: string }).error);
        }
        return null;
      }
    }
  };

  return (
    <BitcoinContext.Provider
      value={{
        status,
        transactions,
        blocks,
        entities,
        riskQueue,
        clusters,
        investigations,
        selectedTx,
        setSelectedTx,
        selectedEntity,
        setSelectedEntity,
        graphData,
        fetchGraph,
        createInvestigation,
        refreshAll,
        isLoading,
        // Investigation Engine
        activeInvestigation,
        investigationGraph,
        investigationFlow,
        investigationLeads,
        fetchInvestigation,
        fetchInvestigationGraph,
        fetchInvestigationFlow,
        fetchInvestigationLeads,
        startInvestigation,
        search,
        analyzeWallet,
      }}
    >
      {children}
    </BitcoinContext.Provider>
  );
};
