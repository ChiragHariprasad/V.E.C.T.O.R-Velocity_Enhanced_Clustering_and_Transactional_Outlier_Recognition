import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Coins, 
  Activity, 
  Share2, 
  ShieldAlert, 
  Clock, 
  ArrowUpRight,
  ChevronRight,
  ExternalLink,
  Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBitcoin } from '../../context/BitcoinContext';
import { BitcoinEntity, BitcoinTransaction } from '../../types/bitcoin';

interface Props {
  onSelectTx: (tx: BitcoinTransaction) => void;
  onOpenGraph: (id: string) => void;
}

const BitcoinAddressEntityExplorer: React.FC<Props> = ({ onSelectTx, onOpenGraph }) => {
  const navigate = useNavigate();
  const { entities, transactions, selectedEntity, setSelectedEntity, startInvestigation } = useBitcoin();
  const [searchTerm, setSearchTerm] = useState('');

  const entity = selectedEntity || entities[0];

  const filteredEntities = entities.filter(e => 
    (e?.entity_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e?.primary_address || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e?.addresses || []).some(a => (a || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const entityTxs = transactions.filter(t => t.entity_id === entity?.entity_id);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Entity Selector Sidebar */}
      <div className="bg-[var(--bg-surface)] rounded-xl p-4 border border-[var(--border-subtle)] shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--behavior-purple)]" />
            Behavioral Entities
          </h3>
          <span className="text-xs text-[var(--text-muted)] font-mono">{entities.length} entities</span>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search address or entity..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] outline-none"
          />
        </div>

        <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1 custom-scrollbar">
          {filteredEntities.map(e => (
            <button
              key={e.entity_id}
              onClick={() => setSelectedEntity(e)}
              className={`w-full text-left p-3 rounded-lg border transition-all text-xs ${
                entity?.entity_id === e.entity_id
                  ? 'bg-[var(--accent-primary)]/20 border-[var(--accent-primary)]/50 shadow-sm'
                  : 'bg-[var(--bg-elevated)] border-[var(--border-default)] hover:border-[var(--accent-primary)]/40 hover:bg-[var(--bg-elevated)]/80'
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-mono font-bold text-[var(--text-primary)]">{e.entity_id}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  e.risk_level === 'CRITICAL' ? 'bg-[var(--risk-critical)]/20 text-[var(--risk-critical)] border border-[var(--risk-critical)]/40' :
                  e.risk_level === 'HIGH' ? 'bg-orange-500/20 text-orange-500 border border-orange-500/40' :
                  e.risk_level === 'MEDIUM' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/40' :
                  'bg-[var(--success)]/20 text-[var(--success)] border border-[var(--success)]/40'
                }`}>
                  Risk: {e.risk_score}
                </span>
              </div>
              <div className="text-[11px] text-[var(--text-muted)] truncate font-mono">{e.primary_address}</div>
              <div className="flex justify-between text-[11px] text-[var(--text-muted)] opacity-90 mt-2 pt-1.5 border-t border-[var(--border-default)]">
                <span>{e.tx_count || 0} txs</span>
                <span className="font-semibold text-[var(--text-primary)]">₿ {typeof e.total_received_btc === 'number' ? e.total_received_btc.toFixed(2) : (e.total_received_btc || '0.00')}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Entity Profile & Associated Transactions */}
      <div className="lg:col-span-2 space-y-6">
        {entity ? (
          <>
            {/* Entity Header */}
            <div className="bg-[var(--bg-surface)] rounded-xl p-6 border border-[var(--border-subtle)] shadow-sm">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[var(--border-subtle)] pb-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[var(--behavior-purple)]/20 text-[var(--behavior-purple)]">
                      Behavioral Cluster Entity
                    </span>
                    <span className="text-xs text-[var(--text-muted)] font-mono">Cluster #{entity.cluster_id}</span>
                  </div>
                  <h2 className="text-xl font-mono font-bold text-[var(--text-primary)]">{entity.entity_id}</h2>
                  <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5 truncate max-w-lg">
                    Primary: {entity.primary_address}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    onClick={() => navigate(`/bitcoin/wallet/${encodeURIComponent(entity.entity_id)}`)}
                    className="inline-flex items-center text-xs font-bold text-slate-950 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] px-3 py-2 rounded-lg transition-colors shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1.5" /> Full Intelligence
                  </button>
                  <button
                    onClick={() => {
                      startInvestigation(entity.entity_id);
                      navigate('/bitcoin/investigations');
                    }}
                    className="inline-flex items-center text-xs font-semibold text-[var(--risk-critical)] bg-[var(--risk-critical)]/10 px-3 py-2 rounded-lg hover:bg-[var(--risk-critical)]/20 border border-[var(--risk-critical)]/30 transition-colors"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 mr-1.5" /> Investigate
                  </button>
                  <button
                    onClick={() => onOpenGraph(entity.entity_id)}
                    className="inline-flex items-center text-xs font-semibold text-[var(--network-cyan)] bg-[var(--network-cyan)]/10 px-3 py-2 rounded-lg hover:bg-[var(--network-cyan)]/20 border border-[var(--network-cyan)]/30 transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5 mr-1.5" /> Graph View
                  </button>
                  <div className={`px-3 py-1.5 rounded-lg border text-right ${
                    entity.risk_level === 'CRITICAL' ? 'bg-[var(--risk-critical)]/15 border-[var(--risk-critical)]/40 text-[var(--risk-critical)]' :
                    entity.risk_level === 'HIGH' ? 'bg-orange-500/15 border-orange-500/40 text-orange-500' :
                    entity.risk_level === 'MEDIUM' ? 'bg-amber-500/15 border-amber-500/40 text-amber-500' :
                    'bg-[var(--success)]/15 border-[var(--success)]/40 text-[var(--success)]'
                  }`}>
                    <div className="text-[9px] uppercase font-bold tracking-wider">Risk Score</div>
                    <div className="text-base font-bold font-mono">{entity.risk_score} / 100</div>
                  </div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border-subtle)] mb-4">
                <div>
                  <span className="text-xs text-[var(--text-muted)] block">Total Inflow</span>
                  <span className="text-sm font-mono font-bold text-[var(--text-primary)]">₿ {typeof entity.total_received_btc === 'number' ? entity.total_received_btc.toFixed(4) : (entity.total_received_btc || '0.0000')}</span>
                </div>
                <div>
                  <span className="text-xs text-[var(--text-muted)] block">1H / 24H Velocity</span>
                  <span className="text-sm font-mono font-bold text-[var(--accent-primary)]">{entity.velocity_1h || 0} / {entity.velocity_24h || ((entity.velocity_1h || 0) * 8)} tx</span>
                </div>
                <div>
                  <span className="text-xs text-[var(--text-muted)] block">Unique Counterparties</span>
                  <span className="text-sm font-mono font-bold text-[var(--text-primary)]">{entity.unique_counterparties || entity.cross_entity_links || 0} peers</span>
                </div>
                <div>
                  <span className="text-xs text-[var(--text-muted)] block">PageRank Centrality</span>
                  <span className="text-sm font-mono font-bold text-[var(--network-cyan)]">{typeof entity.pagerank === 'number' ? entity.pagerank.toFixed(5) : '0.00182'}</span>
                </div>
              </div>

              <div className="text-xs text-[var(--text-primary)] bg-[var(--behavior-purple)]/10 p-3 rounded-lg border border-[var(--behavior-purple)]/30">
                <strong className="text-[var(--behavior-purple)] font-bold">Behavioral Profile:</strong> {entity.cluster_description || `Cluster #${entity.cluster_id} Behavioral Archetype`}
              </div>
            </div>

            {/* Linked Addresses */}
            <div className="bg-[var(--bg-surface)] rounded-xl p-5 border border-[var(--border-subtle)] shadow-sm">
              <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                Associated Addresses in Entity Clustered via Common-Inputs ({entity.addresses?.length || 1})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {entity.addresses?.map((addr, i) => (
                  <div key={i} className="flex justify-between items-center p-2.5 bg-[var(--bg-elevated)] rounded-lg text-xs font-mono text-[var(--text-primary)] border border-[var(--border-default)]">
                    <span className="truncate">{addr}</span>
                    <span className="text-[11px] text-[var(--text-muted)] font-sans ml-2">Linked Address #{i+1}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Transaction History for Entity */}
            <div className="bg-[var(--bg-surface)] rounded-xl p-5 border border-[var(--border-subtle)] shadow-sm">
              <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                Recent Entity Transactions ({entityTxs.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                {entityTxs.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)] py-4 text-center">No transactions recorded for this entity.</p>
                ) : (
                  entityTxs.map(t => (
                    <div key={t.txid} className="flex justify-between items-center p-3 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg text-xs hover:border-[var(--accent-primary)]/40 transition-colors">
                      <div>
                        <span className="font-mono text-[var(--text-primary)] font-bold block">{t.txid.slice(0, 16)}...</span>
                        <span className="text-[11px] text-[var(--text-muted)]">Block #{t.block_height} • {t.time}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-[var(--text-primary)]">₿ {typeof t.total_output_btc === 'number' ? t.total_output_btc.toFixed(4) : (t.total_output_btc || (t as any).amount || '0.0000')}</span>
                        <button
                          onClick={() => onSelectTx(t)}
                          className="text-xs text-[var(--network-cyan)] hover:text-[var(--network-cyan)]/80 font-medium"
                        >
                          Inspect →
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="bg-[var(--bg-surface)] rounded-xl p-12 text-center text-[var(--text-muted)] border border-[var(--border-subtle)]">Select an entity to view profile.</div>
        )}
      </div>
    </div>
  );
};

export default BitcoinAddressEntityExplorer;
