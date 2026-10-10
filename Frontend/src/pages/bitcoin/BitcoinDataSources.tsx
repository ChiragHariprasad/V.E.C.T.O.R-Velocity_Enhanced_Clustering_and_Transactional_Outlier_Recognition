import React from 'react';
import { Database, Server, HardDrive, RefreshCw, Cpu } from 'lucide-react';
import { useBitcoin } from '../../context/BitcoinContext';

export const BitcoinDataSources: React.FC = () => {
  const { status, refreshAll, isLoading } = useBitcoin();

  const isRpcConnected = status?.node?.status === 'CONNECTED' || status?.node_status === 'CONNECTED';
  const network = status?.network || 'regtest';

  return (
    <div className="space-y-6">
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--behavior-purple)]/10 border border-[var(--behavior-purple)]/30 flex items-center justify-center shrink-0">
              <Database className="w-6 h-6 text-[var(--behavior-purple)]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">Data Sources & Ingestion Pipelines</h1>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Connected blockchain nodes, transactional datastores, and feature caches.
              </p>
            </div>
          </div>
          <button
            onClick={() => refreshAll()}
            disabled={isLoading}
            className="px-3.5 py-2 bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-xl text-xs font-semibold text-[var(--text-primary)] transition-all flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 text-[var(--accent-primary)] ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Checking Connectivity...' : 'Check Status'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Source 1: Bitcoin Core Node */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Server className="w-5 h-5 text-[var(--accent-primary)]" />
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Bitcoin Core Node</h2>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isRpcConnected 
                ? 'bg-[var(--success)]/15 text-[var(--success)] border border-[var(--success)]/30'
                : 'bg-[var(--risk-high)]/15 text-[var(--risk-high)] border border-[var(--risk-high)]/30'
            }`}>
              {isRpcConnected ? 'ACTIVE' : 'OFFLINE / DISCONNECTED'}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Interface</span>
              <span className="font-mono text-[var(--text-primary)]">JSON-RPC (Read-Only)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Network</span>
              <span className="font-mono uppercase text-[var(--text-primary)]">{network}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Current Block Height</span>
              <span className="font-mono text-[var(--text-primary)]">
                {status?.current_block_height !== null ? `#${status?.current_block_height}` : 'NOT AVAILABLE'}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[var(--text-muted)]">Mempool Backlog</span>
              <span className="font-mono text-[var(--text-primary)]">
                {status?.node?.mempool_txs !== null ? `${status?.node?.mempool_txs} txs` : 'NOT AVAILABLE'}
              </span>
            </div>
          </div>
        </div>

        {/* Source 2: MongoDB Vector & Entity Store */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <HardDrive className="w-5 h-5 text-[var(--network-cyan)]" />
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Transactional Store</h2>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--success)]/15 text-[var(--success)] border border-[var(--success)]/30">
              CONNECTED
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Engine</span>
              <span className="font-mono text-[var(--text-primary)]">MongoDB 27017</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Monitored Blocks</span>
              <span className="font-mono text-[var(--text-primary)]">{status?.storage?.total_blocks_processed || status?.total_blocks_processed || 0}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Indexed Entities</span>
              <span className="font-mono text-[var(--text-primary)]">{status?.storage?.total_entities || status?.total_entities || 0}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[var(--text-muted)]">Monitored Volume</span>
              <span className="font-mono text-[var(--accent-primary)] font-bold">₿ {status?.total_btc_monitored?.toFixed(4) || '0.0000'}</span>
            </div>
          </div>
        </div>

        {/* Source 3: Behavioral Cluster Cache */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Cpu className="w-5 h-5 text-[var(--behavior-purple)]" />
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Inference Cache</h2>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--success)]/15 text-[var(--success)] border border-[var(--success)]/30">
              LOADED
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">UMAP Embeddings</span>
              <span className="font-mono text-[var(--text-primary)]">2D Manifold Projection</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Risk Decay Model</span>
              <span className="font-mono text-[var(--text-primary)]">3-Hop Multi-Factor</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">Lead Generation</span>
              <span className="font-mono text-[var(--text-primary)]">Real-time Autonomous</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[var(--text-muted)]">Active Cases</span>
              <span className="font-mono text-[var(--text-primary)] font-bold">
                {(status?.critical_leads_count || 0) + (status?.high_leads_count || 0)} Triggers
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BitcoinDataSources;
