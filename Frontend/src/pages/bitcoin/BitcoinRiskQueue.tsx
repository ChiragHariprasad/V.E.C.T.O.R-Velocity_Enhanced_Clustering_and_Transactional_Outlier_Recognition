import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Search, 
  ChevronRight, 
  Tag, 
  FilePlus,
  CheckCircle,
  Crosshair,
  ExternalLink,
  Coins,
  AlertTriangle,
  Flame,
  Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBitcoin } from '../../context/BitcoinContext';
import { BitcoinRiskLead, BitcoinTransaction } from '../../types/bitcoin';

interface Props {
  onSelectTx: (tx: BitcoinTransaction) => void;
  onCreateCase: (lead: BitcoinRiskLead) => void;
  onInvestigate?: (lead: BitcoinRiskLead) => void;
}

const BitcoinRiskQueue: React.FC<Props> = ({ onSelectTx, onCreateCase, onInvestigate }) => {
  const navigate = useNavigate();
  const { riskQueue, transactions, investigations, startInvestigation } = useBitcoin();
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Calculate priority P1/P2/P3/P4 for each lead
  const getLeadPriority = (lead: BitcoinRiskLead): 'P1' | 'P2' | 'P3' | 'P4' => {
    if (lead.risk_level === 'CRITICAL' || lead.risk_score >= 70) return 'P1';
    if (lead.risk_level === 'HIGH' || lead.risk_score >= 55) return 'P2';
    if (lead.risk_level === 'MEDIUM' || lead.risk_score >= 35) return 'P3';
    return 'P4';
  };

  const prioritizedLeads = riskQueue.map(lead => ({
    ...lead,
    priority: getLeadPriority(lead),
    activeCase: investigations.find(inv => 
      inv.primary_entity === lead.entity_id || 
      inv.entities?.includes(lead.entity_id) || 
      inv.transactions?.includes(lead.txid)
    )
  }));

  // Sort P1 -> P2 -> P3 -> P4, then by risk score descending
  prioritizedLeads.sort((a, b) => {
    const pRank = { P1: 1, P2: 2, P3: 3, P4: 4 };
    if (pRank[a.priority] !== pRank[b.priority]) {
      return pRank[a.priority] - pRank[b.priority];
    }
    return (b.risk_score || 0) - (a.risk_score || 0);
  });

  const filteredLeads = prioritizedLeads.filter(lead => {
    const matchesSearch = 
      lead.lead_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.entity_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.txid.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.explanation.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterPriority === 'ALL') return matchesSearch;
    return matchesSearch && lead.priority === filterPriority;
  });

  return (
    <div className="space-y-4">
      {/* Risk Queue Header */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border-subtle)] shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-5 h-5 text-[var(--risk-critical)]" />
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              Prioritized Investigative Lead Queue
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[var(--risk-critical)]/15 border border-[var(--risk-critical)]/30 text-[var(--risk-critical)]">
              Actionable Triage
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Answers: <strong>"WHAT SHOULD I INVESTIGATE FIRST?"</strong> — Ranked by ML anomaly severity & seed proximity
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search leads, entity, explanation..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] focus:border-amber-500/60 rounded-xl pl-9 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
            />
          </div>

          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            className="text-xs bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--text-secondary)] rounded-xl px-3 py-1.5 outline-none focus:border-amber-500 font-semibold"
          >
            <option value="ALL">All Priorities</option>
            <option value="P1">P1 — Critical Priority</option>
            <option value="P2">P2 — High Priority</option>
            <option value="P3">P3 — Medium Priority</option>
            <option value="P4">P4 — Low Priority</option>
          </select>
        </div>
      </div>

      {/* Priority Summary Quick Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['P1', 'P2', 'P3', 'P4'] as const).map(p => {
          const count = prioritizedLeads.filter(l => l.priority === p).length;
          const colorClass = 
            p === 'P1' ? 'text-[var(--risk-critical)] border-[var(--risk-critical)]/40 bg-[var(--risk-critical)]/10' :
            p === 'P2' ? 'text-orange-500 border-orange-500/40 bg-orange-500/10' :
            p === 'P3' ? 'text-amber-500 border-amber-500/40 bg-amber-500/10' :
            'text-emerald-500 border-emerald-500/40 bg-emerald-500/10';

          return (
            <button
              key={p}
              onClick={() => setFilterPriority(p === filterPriority ? 'ALL' : p)}
              className={`p-3 rounded-xl border text-left transition-all ${
                filterPriority === p ? 'ring-2 ring-[var(--accent-primary)] shadow-md' : 'bg-[var(--bg-surface)]'
              } ${colorClass}`}
            >
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold font-mono uppercase">{p} Severity</span>
                <span className="text-lg font-black font-mono">{count}</span>
              </div>
              <span className="text-[10px] opacity-80 block mt-0.5">
                {p === 'P1' ? 'Immediate Triage' : p === 'P2' ? 'High Risk' : p === 'P3' ? 'Under Review' : 'Baseline'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Leads List */}
      <div className="space-y-3">
        {filteredLeads.length === 0 ? (
          <div className="bg-[var(--bg-surface)] rounded-2xl p-12 text-center border border-[var(--border-subtle)] shadow-lg">
            <CheckCircle className="w-12 h-12 text-[var(--success)] mx-auto mb-3" />
            <h3 className="text-base font-bold text-[var(--text-primary)]">Queue is Clear</h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">No active leads match your current severity filters.</p>
          </div>
        ) : (
          filteredLeads.map(lead => {
            const relatedTx = transactions.find(t => t.txid === lead.txid);
            const p = lead.priority;
            const pBadgeClass = 
              p === 'P1' ? 'bg-[var(--risk-critical)]/20 text-[var(--risk-critical)] border-[var(--risk-critical)]/50' :
              p === 'P2' ? 'bg-orange-500/20 text-orange-500 border-orange-500/50' :
              p === 'P3' ? 'bg-amber-500/20 text-amber-500 border-amber-500/50' :
              'bg-emerald-500/20 text-emerald-500 border-emerald-500/50';

            const txAmountBtc = relatedTx?.total_output_btc;

            return (
              <div 
                key={lead.lead_id} 
                className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border-subtle)] shadow-lg hover:border-[var(--accent-primary)]/40 transition-all space-y-3"
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Priority Tag */}
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-black font-mono border ${pBadgeClass}`}>
                      {p} PRIORITY
                    </span>

                    {/* Risk Score */}
                    <span className="text-xs font-mono font-bold text-[var(--text-primary)] bg-[var(--bg-elevated)] border border-[var(--border-default)] px-2.5 py-1 rounded-lg">
                      Risk Score: {lead.risk_score?.toFixed(1)} / 100
                    </span>

                    {/* Entity Tag */}
                    <button
                      onClick={() => navigate(`/bitcoin/wallet/${encodeURIComponent(lead.entity_id)}`)}
                      className="font-mono text-xs text-indigo-400 hover:underline bg-indigo-500/15 border border-indigo-500/30 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1"
                      title="Inspect Entity Intelligence"
                    >
                      {lead.entity_id} <ExternalLink className="w-3 h-3" />
                    </button>

                    {/* Active Investigation Tag */}
                    {lead.activeCase ? (
                      <span 
                        onClick={() => navigate(`/bitcoin/investigations/${lead.activeCase?.investigation_id}`)}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30 cursor-pointer hover:underline"
                      >
                        Case Active ({lead.activeCase.investigation_id})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                        Unassigned Triage
                      </span>
                    )}
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
                    {relatedTx && (
                      <button
                        onClick={() => onSelectTx(relatedTx)}
                        className="inline-flex items-center text-xs font-semibold text-cyan-500 hover:text-cyan-600 bg-cyan-500/10 border border-cyan-500/30 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Inspect TX <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                      </button>
                    )}
                    
                    <button
                      onClick={() => {
                        if (lead.activeCase) {
                          navigate(`/bitcoin/investigations/${lead.activeCase.investigation_id}`);
                        } else {
                          startInvestigation(lead.entity_id);
                          navigate('/bitcoin/investigations');
                        }
                      }}
                      className="inline-flex items-center text-xs font-bold text-white bg-[var(--risk-critical)] hover:bg-[var(--risk-critical)]/90 px-3 py-1.5 rounded-lg shadow-sm transition-colors"
                    >
                      <Crosshair className="w-3.5 h-3.5 mr-1" />
                      {lead.activeCase ? 'Open Dossier' : 'Launch Investigation'}
                    </button>
                  </div>
                </div>

                {/* Analytical Trigger Explanation */}
                <div className="bg-[var(--bg-elevated)] p-3 rounded-xl border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] leading-relaxed">
                  <span className="font-semibold text-[var(--accent-primary)] mr-1">ML Outlier Trigger:</span>
                  {lead.explanation}
                </div>

                {/* Signals, Transaction & Volume Metadata Strip */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-[var(--text-muted)] mr-1">Signals:</span>
                    {lead.signals && lead.signals.length > 0 ? (
                      lead.signals.map((sig, i) => (
                        <span key={i} className="inline-flex items-center text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-medium">
                          <Tag className="w-2.5 h-2.5 mr-1" />
                          {sig.replace(/_/g, ' ')}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-[var(--text-muted)]">Isolation Forest Behavioral Anomaly</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 font-mono text-[11px] text-[var(--text-muted)]">
                    {txAmountBtc !== undefined && (
                      <span className="font-bold text-[var(--text-primary)] flex items-center gap-1">
                        <Coins className="w-3 h-3 text-[var(--accent-primary)]" />
                        ₿ {txAmountBtc.toFixed(4)} BTC
                      </span>
                    )}
                    <span>TX: {lead.txid?.slice(0, 12)}...</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default BitcoinRiskQueue;
