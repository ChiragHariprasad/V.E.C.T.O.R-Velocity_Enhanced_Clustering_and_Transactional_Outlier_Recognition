import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ShieldAlert, 
  Activity, 
  Users, 
  Box, 
  ArrowLeft, 
  Share2, 
  AlertTriangle,
  Clock,
  TrendingUp,
  Fingerprint,
  Cpu,
  ExternalLink,
  Network,
  FileSearch,
  Search,
  AlertCircle
} from 'lucide-react';
import { useBitcoin } from '../../context/BitcoinContext';
import { WalletAnalysis } from '../../types/bitcoin';

const WalletIntelligence: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { analyzeWallet, startInvestigation, setSelectedEntity, entities } = useBitcoin();
  
  const [analysis, setAnalysis] = useState<WalletAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    
    // Clear previous state immediately to prevent stale leakage
    setIsAnalyzing(true);
    setError('');
    setAnalysis(null);
    
    // Execute real backend analysis immediately without artificial delay
    analyzeWallet(id)
      .then(data => {
        if (data) {
          setAnalysis(data);
          if (data.entity?.entity_id) {
            const matched = entities.find(e => e.entity_id === data.entity.entity_id);
            if (matched) {
              setSelectedEntity(matched);
            }
          }
        } else {
          setError('Failed to analyze wallet or identifier not found.');
        }
      })
      .catch((err: Error | unknown) => {
        setError(err instanceof Error ? err.message : 'Error occurred during wallet intelligence extraction.');
      })
      .finally(() => {
        setIsAnalyzing(false);
      });
  }, [id, analyzeWallet, setSelectedEntity, entities]);

  if (isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-2xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 flex items-center justify-center animate-pulse">
            <Cpu className="w-8 h-8 text-[var(--accent-primary)] animate-spin" style={{ animationDuration: '4s' }} />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[var(--network-cyan)] flex items-center justify-center">
            <Activity className="w-3 h-3 text-black" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Executing V.E.C.T.O.R Analysis</h2>
        <p className="font-mono text-xs text-[var(--accent-primary)] mt-2 px-3 py-1.5 bg-[var(--bg-surface)] rounded-lg border border-[var(--border-subtle)] max-w-xl truncate">
          Target: {id}
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-3 max-w-md">
          Resolving behavioral entity, tracing UTXO graph topology, and running Isolation Forest & XGBoost outlier models...
        </p>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[var(--risk-critical)]/10 border border-[var(--risk-critical)]/30 flex items-center justify-center mb-4 text-[var(--risk-critical)]">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Analysis Request Failed</h2>
        <p className="text-[var(--risk-critical)] text-sm font-mono mt-2 max-w-lg bg-[var(--risk-critical)]/5 px-4 py-2 rounded-lg border border-[var(--risk-critical)]/20">
          {error || 'Target identifier could not be resolved'}
        </p>
        <div className="flex items-center gap-3 mt-6">
          <button 
            onClick={() => navigate('/bitcoin')}
            className="px-4 py-2 bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-lg hover:bg-[var(--bg-elevated)]/80 text-[var(--text-primary)] text-sm font-medium transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const isColdStart = analysis.is_known === false;
  const isHighRisk = analysis.risk.score >= 70;
  const isMediumRisk = analysis.risk.score >= 35 && analysis.risk.score < 70;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4">
          <button 
            onClick={() => navigate('/bitcoin')}
            className="p-2 hover:bg-[var(--bg-elevated)] rounded-lg text-[var(--text-muted)] transition-colors border border-transparent hover:border-[var(--border-subtle)] mt-1 sm:mt-0"
            title="Return to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Wallet Intelligence Profile</h1>
              <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                isHighRisk 
                  ? 'bg-[var(--risk-critical)]/20 text-[var(--risk-critical)] border border-[var(--risk-critical)]/30' 
                  : isMediumRisk
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-[var(--success)]/20 text-[var(--success)] border border-[var(--success)]/30'
              }`}>
                {analysis.risk.level} RISK ({analysis.risk.score}/100)
              </span>
              {isColdStart && (
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  COLD START
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-xs text-[var(--text-muted)]">Input:</span>
              <span className="text-xs font-mono font-semibold text-[var(--network-cyan)] bg-[var(--bg-surface)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                {analysis.query_input || id}
              </span>
              {analysis.entity?.entity_id && (
                <>
                  <span className="text-xs text-[var(--text-muted)]">→ Entity:</span>
                  <span className="text-xs font-mono font-semibold text-[var(--behavior-purple)] bg-[var(--behavior-purple)]/10 px-2 py-0.5 rounded border border-[var(--behavior-purple)]/30">
                    {analysis.entity.entity_id}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        
        {analysis.investigation?.active ? (
          <button 
            onClick={() => navigate(`/bitcoin/investigations/${analysis.investigation?.id}`)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--risk-critical)]/15 text-[var(--risk-critical)] border border-[var(--risk-critical)]/40 rounded-lg hover:bg-[var(--risk-critical)]/25 transition-all font-semibold text-sm self-start sm:self-auto"
          >
            <ShieldAlert className="w-4 h-4" />
            Active Investigation ({analysis.investigation.id})
          </button>
        ) : analysis.investigation_recommended ? (
          <button 
            onClick={async () => {
              if (analysis.entity.entity_id) {
                await startInvestigation(analysis.entity.entity_id);
                navigate('/bitcoin/investigations');
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--risk-critical)]/15 text-[var(--risk-critical)] border border-[var(--risk-critical)]/40 rounded-lg hover:bg-[var(--risk-critical)]/25 transition-all font-semibold text-sm self-start sm:self-auto"
          >
            <ShieldAlert className="w-4 h-4" />
            Launch Full Investigation
          </button>
        ) : null}
      </div>

      {/* Cold start alert if applicable */}
      {isColdStart && (
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-sm block mb-1">Unrecorded On-Chain Address</span>
            Address format is valid Bitcoin identifier, but no transactions currently exist in the ingested block dataset. Baseline zero risk has been established.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Entity & Risk */}
        <div className="space-y-6">
          {/* Risk Card */}
          <div className="bg-[var(--bg-surface)] rounded-xl p-6 border border-[var(--border-subtle)] shadow-sm relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1.5 h-full ${
              isHighRisk ? 'bg-[var(--risk-critical)]' : isMediumRisk ? 'bg-amber-400' : 'bg-[var(--success)]'
            }`} />
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[var(--accent-primary)]" /> Risk Assessment
            </h3>
            
            <div className="flex items-end gap-2 mb-6">
              <span className={`text-4xl font-bold font-mono ${
                isHighRisk ? 'text-[var(--risk-critical)]' : isMediumRisk ? 'text-amber-400' : 'text-[var(--success)]'
              }`}>
                {analysis.risk.score.toFixed(1)}
              </span>
              <span className="text-[var(--text-muted)] mb-1 text-sm font-mono">/ 100</span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[var(--text-muted)]">ML Behavioral Outlier</span>
                <span className="font-mono font-semibold text-[var(--text-primary)]">{analysis.risk.components.ml_anomaly} pts</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[var(--text-muted)]">Graph Topology Risk</span>
                <span className="font-mono font-semibold text-[var(--text-primary)]">{analysis.risk.components.graph_risk} pts</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[var(--text-muted)]">Velocity Spike Signal</span>
                <span className="font-mono font-semibold text-[var(--text-primary)]">{analysis.risk.components.velocity_signal} pts</span>
              </div>
              {analysis.risk.propagated_risk > 0 && (
                <div className="flex justify-between items-center text-xs pt-2 border-t border-[var(--border-subtle)]">
                  <span className="text-[var(--text-muted)] font-semibold flex items-center gap-1">
                    <Share2 className="w-3.5 h-3.5 text-[var(--risk-critical)]" /> Propagated Seed Risk
                  </span>
                  <span className="font-mono font-bold text-[var(--risk-critical)]">+{analysis.risk.propagated_risk} pts</span>
                </div>
              )}
            </div>
          </div>

          {/* Entity Attribution */}
          <div className="bg-[var(--bg-surface)] rounded-xl p-6 border border-[var(--border-subtle)] shadow-sm">
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-[var(--behavior-purple)]" /> Behavioral Entity Attribution
            </h3>
            
            <div className="mb-4">
              <span className="text-[11px] text-[var(--text-muted)] block mb-1">Assigned Entity ID</span>
              <span className="text-base font-mono font-bold text-[var(--behavior-purple)] break-all">
                {analysis.entity.entity_id || 'N/A (Cold Address)'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-[var(--bg-elevated)] p-3 rounded-lg border border-[var(--border-default)]">
                <span className="text-[10px] text-[var(--text-muted)] uppercase block mb-1">Known Addresses</span>
                <span className="font-mono text-[var(--text-primary)] font-bold text-sm">{analysis.entity.address_count}</span>
              </div>
              <div className="bg-[var(--bg-elevated)] p-3 rounded-lg border border-[var(--border-default)]">
                <span className="text-[10px] text-[var(--text-muted)] uppercase block mb-1">HDBSCAN Cluster</span>
                <span className="font-mono text-[var(--accent-primary)] font-bold text-sm">#{analysis.entity.cluster_id}</span>
              </div>
            </div>

            {analysis.cluster && (
              <div className="bg-[var(--bg-elevated)]/60 p-3 rounded-lg border border-[var(--border-subtle)] mb-4 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[var(--text-muted)] font-medium">Cluster Archetype:</span>
                  <span className="text-[var(--accent-primary)] font-semibold">{analysis.cluster.archetype}</span>
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  {analysis.cluster.description || analysis.cluster.name}
                </div>
              </div>
            )}
            
            <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">First Seen</span>
                <span className="font-mono text-[var(--text-primary)]">{analysis.entity.first_seen ? analysis.entity.first_seen.split('T')[0] : 'Never'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Last Active</span>
                <span className="font-mono text-[var(--text-primary)]">{analysis.entity.last_seen ? analysis.entity.last_seen.split('T')[0] : 'Never'}</span>
              </div>
            </div>
          </div>

          {/* Graph Connectivity Summary */}
          {analysis.graph && (
            <div className="bg-[var(--bg-surface)] rounded-xl p-6 border border-[var(--border-subtle)] shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
                  <Network className="w-4 h-4 text-[var(--network-cyan)]" /> Graph Topology
                </h3>
                <button
                  onClick={() => navigate('/bitcoin/graph')}
                  className="text-xs text-[var(--accent-primary)] hover:underline flex items-center gap-1 font-medium"
                >
                  Graph View <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div className="bg-[var(--bg-elevated)] p-2.5 rounded-lg border border-[var(--border-default)]">
                  <span className="text-[10px] text-[var(--text-muted)] block">Neighbors</span>
                  <span className="font-mono font-bold text-sm text-[var(--network-cyan)]">{analysis.graph.stats?.total_neighbors || analysis.graph.nodes.length}</span>
                </div>
                <div className="bg-[var(--bg-elevated)] p-2.5 rounded-lg border border-[var(--border-default)]">
                  <span className="text-[10px] text-[var(--text-muted)] block">In-Degree</span>
                  <span className="font-mono font-bold text-sm text-[var(--text-primary)]">{analysis.graph.stats?.in_degree ?? 0}</span>
                </div>
                <div className="bg-[var(--bg-elevated)] p-2.5 rounded-lg border border-[var(--border-default)]">
                  <span className="text-[10px] text-[var(--text-muted)] block">Out-Degree</span>
                  <span className="font-mono font-bold text-sm text-[var(--text-primary)]">{analysis.graph.stats?.out_degree ?? 0}</span>
                </div>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                Direct 1-hop transactional neighborhood computed from graph database.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Behavior, Patterns, Leads & Transactions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[var(--bg-surface)] p-5 rounded-xl border border-[var(--border-subtle)] shadow-sm">
              <div className="text-[var(--text-muted)] text-xs font-semibold mb-2 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[var(--accent-primary)]" /> 1H Velocity
              </div>
              <div className="text-xl font-mono font-bold text-[var(--accent-primary)]">
                {analysis.behavior.velocity_1h} <span className="text-xs text-[var(--text-muted)] font-sans font-normal">tx/hr</span>
              </div>
            </div>
            <div className="bg-[var(--bg-surface)] p-5 rounded-xl border border-[var(--border-subtle)] shadow-sm">
              <div className="text-[var(--text-muted)] text-xs font-semibold mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[var(--network-cyan)]" /> 24H Velocity
              </div>
              <div className="text-xl font-mono font-bold text-[var(--text-primary)]">
                {analysis.behavior.velocity_24h} <span className="text-xs text-[var(--text-muted)] font-sans font-normal">tx/day</span>
              </div>
            </div>
            <div className="bg-[var(--bg-surface)] p-5 rounded-xl border border-[var(--border-subtle)] shadow-sm">
              <div className="text-[var(--text-muted)] text-xs font-semibold mb-2 flex items-center gap-1.5">
                <Box className="w-3.5 h-3.5 text-[var(--success)]" /> Total Volume
              </div>
              <div className="text-xl font-mono font-bold text-[var(--success)]">
                {analysis.behavior.total_volume_btc.toFixed(2)} <span className="text-xs text-[var(--text-muted)] font-sans font-normal">BTC</span>
              </div>
            </div>
            <div className="bg-[var(--bg-surface)] p-5 rounded-xl border border-[var(--border-subtle)] shadow-sm">
              <div className="text-[var(--text-muted)] text-xs font-semibold mb-2 flex items-center gap-1.5">
                <Fingerprint className="w-3.5 h-3.5 text-[var(--behavior-purple)]" /> Diversity
              </div>
              <div className="text-xl font-mono font-bold text-[var(--text-primary)]">
                {analysis.behavior.counterparty_diversity} <span className="text-xs text-[var(--text-muted)] font-sans font-normal">peers</span>
              </div>
            </div>
          </div>

          {/* Detected Patterns */}
          <div className="bg-[var(--bg-surface)] rounded-xl p-6 border border-[var(--border-subtle)] shadow-sm">
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--accent-primary)]" /> Behavioral Signatures Detected
            </h3>
            {analysis.patterns.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {analysis.patterns.map((pattern, i) => (
                  <span key={i} className="px-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg text-xs font-medium text-[var(--text-primary)] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-pulse" />
                    {pattern.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">No suspicious behavioral patterns detected for this wallet.</p>
            )}
          </div>

          {/* High Priority Leads / Evidence if present */}
          {analysis.leads && analysis.leads.length > 0 && (
            <div className="bg-[var(--bg-surface)] rounded-xl p-6 border border-[var(--border-subtle)] shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
                  <FileSearch className="w-4 h-4 text-[var(--risk-critical)]" /> Flagged Outlier Leads ({analysis.leads.length})
                </h3>
                <span className="text-[11px] text-[var(--text-muted)]">Ranked by ML Anomaly Score</span>
              </div>
              <div className="space-y-2.5">
                {analysis.leads.slice(0, 3).map((lead, idx) => (
                  <div key={lead.entity_id || idx} className="p-3 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-default)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-[var(--risk-critical)]">{lead.lead_id}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-[var(--risk-critical)]/10 text-[var(--risk-critical)] uppercase">
                          {lead.pattern || 'Outlier'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] mt-1 line-clamp-1">
                        {lead.explanation || `Signals: ${lead.signals?.join(', ') || 'anomalous velocity'}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-bold text-[var(--risk-critical)] block">
                        Risk {lead.risk_score?.toFixed(1) || 0}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">
                        TX: {lead.txid ? lead.txid.substring(0, 10) + '...' : 'N/A'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Transactions */}
          <div className="bg-[var(--bg-surface)] rounded-xl p-6 border border-[var(--border-subtle)] shadow-sm">
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Search className="w-4 h-4 text-[var(--network-cyan)]" /> Recent Transactions ({analysis.transactions.length})
            </h3>
            
            <div className="space-y-2">
              {analysis.transactions.slice(0, 6).map(tx => (
                <div 
                  key={tx.txid} 
                  onClick={() => navigate(`/bitcoin/transactions/${tx.txid}`)}
                  className="flex justify-between items-center p-3 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg hover:border-[var(--accent-primary)]/50 transition-colors cursor-pointer group"
                >
                  <div className="min-w-0 flex-1 pr-4">
                    <span className="font-mono text-xs text-[var(--network-cyan)] group-hover:text-[var(--accent-primary)] transition-colors block mb-1 truncate">
                      {tx.txid}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      Block #{tx.block_height || 'N/A'} • {tx.time || (tx.timestamp ? new Date(tx.timestamp * 1000).toLocaleString() : 'N/A')}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-[var(--text-primary)] block text-xs">
                      ₿ {typeof tx.total_output_btc === 'number' ? tx.total_output_btc.toFixed(4) : (tx.amount_btc || 0).toFixed(4)}
                    </span>
                    <span className={`text-[10px] font-bold ${
                      tx.risk_score >= 70 ? 'text-[var(--risk-critical)]' : tx.risk_score >= 35 ? 'text-amber-400' : 'text-[var(--success)]'
                    }`}>
                      {tx.risk_score?.toFixed(1) || 0} Risk
                    </span>
                  </div>
                </div>
              ))}
              {analysis.transactions.length === 0 && (
                <p className="text-xs text-[var(--text-muted)] text-center py-6">No on-chain transactions recorded for this wallet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletIntelligence;
