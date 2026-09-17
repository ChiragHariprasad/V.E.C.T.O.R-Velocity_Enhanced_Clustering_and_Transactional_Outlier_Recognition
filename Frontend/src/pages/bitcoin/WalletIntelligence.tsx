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
  Fingerprint
} from 'lucide-react';
import { useBitcoin } from '../../context/BitcoinContext';
import { WalletAnalysis } from '../../types/bitcoin';
import AnalysisProgress from '../../components/AnalysisProgress';

const WalletIntelligence: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { analyzeWallet, startInvestigation } = useBitcoin();
  
  const [analysis, setAnalysis] = useState<WalletAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    
    // Simulate initial delay before starting analysis to show the progress screen immediately
    setIsAnalyzing(true);
    
    // Pre-fetch the data while animation runs
    analyzeWallet(id).then(data => {
      if (data) {
        setAnalysis(data);
      } else {
        setError('Failed to analyze wallet or wallet not found in intelligence database.');
      }
    });
  }, [id, analyzeWallet]);

  if (isAnalyzing) {
    return <AnalysisProgress targetAddress={id!} onComplete={() => setIsAnalyzing(false)} />;
  }

  if (error || !analysis) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <AlertTriangle className="w-12 h-12 text-[var(--risk-critical)] mb-4" />
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Analysis Failed</h2>
        <p className="text-[var(--text-muted)] mt-2">{error}</p>
        <button 
          onClick={() => navigate('/bitcoin')}
          className="mt-6 px-4 py-2 bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-lg hover:bg-[var(--bg-elevated)]/80 text-[var(--text-primary)]"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const isHighRisk = analysis.risk.score >= 70;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/bitcoin')}
            className="p-2 hover:bg-[var(--bg-elevated)] rounded-lg text-[var(--text-muted)] transition-colors border border-transparent hover:border-[var(--border-subtle)]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Wallet Intelligence Profile</h1>
              <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                isHighRisk ? 'bg-[var(--risk-critical)]/20 text-[var(--risk-critical)]' : 'bg-[var(--success)]/20 text-[var(--success)]'
              }`}>
                {analysis.risk.level} RISK
              </span>
            </div>
            <p className="text-sm font-mono text-[var(--text-muted)] mt-1">{analysis.address}</p>
          </div>
        </div>
        
        {analysis.investigation_recommended && (
          <button 
            onClick={() => {
              startInvestigation(analysis.entity.entity_id);
              navigate('/bitcoin/investigations');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--risk-critical)]/10 text-[var(--risk-critical)] border border-[var(--risk-critical)]/30 rounded-lg hover:bg-[var(--risk-critical)]/20 transition-all font-semibold text-sm"
          >
            <ShieldAlert className="w-4 h-4" />
            Launch Full Investigation
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Entity & Risk */}
        <div className="space-y-6">
          {/* Risk Card */}
          <div className="bg-[var(--bg-surface)] rounded-xl p-6 border border-[var(--border-subtle)] shadow-sm relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1 h-full ${isHighRisk ? 'bg-[var(--risk-critical)]' : 'bg-[var(--success)]'}`} />
            <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> Risk Assessment
            </h3>
            
            <div className="flex items-end gap-2 mb-6">
              <span className={`text-4xl font-bold ${isHighRisk ? 'text-[var(--risk-critical)]' : 'text-[var(--success)]'}`}>
                {analysis.risk.score}
              </span>
              <span className="text-[var(--text-muted)] mb-1">/ 100</span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-[var(--text-muted)]">ML Behavioral Anomaly</span>
                <span className="font-mono text-[var(--text-primary)]">{analysis.risk.components.ml_anomaly} pts</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[var(--text-muted)]">Graph Connectivity Risk</span>
                <span className="font-mono text-[var(--text-primary)]">{analysis.risk.components.graph_risk} pts</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[var(--text-muted)]">Velocity Spike Signal</span>
                <span className="font-mono text-[var(--text-primary)]">{analysis.risk.components.velocity_signal} pts</span>
              </div>
              {analysis.risk.propagated_risk > 0 && (
                <div className="flex justify-between items-center text-sm pt-2 border-t border-[var(--border-subtle)]">
                  <span className="text-[var(--text-muted)] font-semibold flex items-center gap-1">
                    <Share2 className="w-3.5 h-3.5" /> Propagated Risk
                  </span>
                  <span className="font-mono text-[var(--risk-critical)]">+{analysis.risk.propagated_risk} pts</span>
                </div>
              )}
            </div>
          </div>

          {/* Entity Attribution */}
          <div className="bg-[var(--bg-surface)] rounded-xl p-6 border border-[var(--border-subtle)] shadow-sm">
            <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Users className="w-4 h-4" /> Behavioral Entity Attribution
            </h3>
            
            <div className="mb-4">
              <span className="text-xs text-[var(--text-muted)] block mb-1">Assigned Entity ID</span>
              <span className="text-lg font-mono font-bold text-[var(--behavior-purple)]">{analysis.entity.entity_id}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[var(--bg-elevated)] p-3 rounded-lg border border-[var(--border-default)]">
                <span className="text-[10px] text-[var(--text-muted)] uppercase block mb-1">Known Addresses</span>
                <span className="font-mono text-[var(--text-primary)] font-bold">{analysis.entity.address_count}</span>
              </div>
              <div className="bg-[var(--bg-elevated)] p-3 rounded-lg border border-[var(--border-default)]">
                <span className="text-[10px] text-[var(--text-muted)] uppercase block mb-1">HDBSCAN Cluster</span>
                <span className="font-mono text-[var(--text-primary)] font-bold">#{analysis.entity.cluster_id}</span>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">First Seen</span>
                <span className="font-mono text-[var(--text-primary)]">{analysis.entity.first_seen.split('T')[0]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Last Active</span>
                <span className="font-mono text-[var(--text-primary)]">{analysis.entity.last_seen.split('T')[0]}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Behavior & Patterns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[var(--bg-surface)] p-5 rounded-xl border border-[var(--border-subtle)] shadow-sm">
              <div className="text-[var(--text-muted)] text-xs font-semibold mb-2 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> 1H Velocity
              </div>
              <div className="text-xl font-mono font-bold text-[var(--accent-primary)]">{analysis.behavior.velocity_1h} <span className="text-xs text-[var(--text-muted)] font-sans font-normal">tx/hr</span></div>
            </div>
            <div className="bg-[var(--bg-surface)] p-5 rounded-xl border border-[var(--border-subtle)] shadow-sm">
              <div className="text-[var(--text-muted)] text-xs font-semibold mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> 24H Velocity
              </div>
              <div className="text-xl font-mono font-bold text-[var(--text-primary)]">{analysis.behavior.velocity_24h} <span className="text-xs text-[var(--text-muted)] font-sans font-normal">tx/day</span></div>
            </div>
            <div className="bg-[var(--bg-surface)] p-5 rounded-xl border border-[var(--border-subtle)] shadow-sm">
              <div className="text-[var(--text-muted)] text-xs font-semibold mb-2 flex items-center gap-1.5">
                <Box className="w-3.5 h-3.5" /> Total Volume
              </div>
              <div className="text-xl font-mono font-bold text-[var(--success)]">{analysis.behavior.total_volume_btc.toFixed(2)} <span className="text-xs text-[var(--text-muted)] font-sans font-normal">BTC</span></div>
            </div>
            <div className="bg-[var(--bg-surface)] p-5 rounded-xl border border-[var(--border-subtle)] shadow-sm">
              <div className="text-[var(--text-muted)] text-xs font-semibold mb-2 flex items-center gap-1.5">
                <Fingerprint className="w-3.5 h-3.5" /> Diversity
              </div>
              <div className="text-xl font-mono font-bold text-[var(--text-primary)]">{analysis.behavior.counterparty_diversity} <span className="text-xs text-[var(--text-muted)] font-sans font-normal">peers</span></div>
            </div>
          </div>

          {/* Detected Patterns */}
          <div className="bg-[var(--bg-surface)] rounded-xl p-6 border border-[var(--border-subtle)] shadow-sm">
            <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Behavioral Signatures Detected
            </h3>
            {analysis.patterns.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {analysis.patterns.map((pattern, i) => (
                  <span key={i} className="px-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg text-xs font-medium text-[var(--text-primary)] flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]" />
                    {pattern.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">No distinct behavioral signatures detected for this wallet.</p>
            )}
          </div>

          {/* Recent Transactions */}
          <div className="bg-[var(--bg-surface)] rounded-xl p-6 border border-[var(--border-subtle)] shadow-sm">
            <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Search className="w-4 h-4" /> Recent Transactions
            </h3>
            
            <div className="space-y-2">
              {analysis.transactions.slice(0, 5).map(tx => (
                <div key={tx.txid} className="flex justify-between items-center p-3 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg hover:border-[var(--accent-primary)]/40 transition-colors">
                  <div>
                    <span className="font-mono text-xs text-[var(--network-cyan)] block mb-1">{tx.txid}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">Block #{tx.block_height} • {tx.time}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-[var(--text-primary)] block text-sm">₿ {tx.total_output_btc.toFixed(4)}</span>
                    <span className="text-[10px] font-bold text-[var(--risk-critical)]">{tx.risk_score} Risk</span>
                  </div>
                </div>
              ))}
              {analysis.transactions.length === 0 && (
                <p className="text-sm text-[var(--text-muted)] text-center py-4">No recent transactions found.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletIntelligence;
