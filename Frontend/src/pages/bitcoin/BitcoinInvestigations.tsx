import React, { useState } from 'react';
import { 
  FileText, 
  PlusCircle, 
  Clock, 
  ShieldAlert, 
  CheckCircle, 
  User, 
  Tag,
  ChevronRight,
  FolderOpen,
  Eye,
  Users,
  Target,
  Layers,
  Zap
} from 'lucide-react';
import { useBitcoin } from '../../context/BitcoinContext';
import { BitcoinRiskLead } from '../../types/bitcoin';

interface Props {
  initialLead?: BitcoinRiskLead | null;
  onViewInvestigation?: (investigationId: string) => void;
}

const BitcoinInvestigations: React.FC<Props> = ({ initialLead, onViewInvestigation }) => {
  const { investigations, createInvestigation, entities } = useBitcoin();
  const [showNewModal, setShowNewModal] = useState(Boolean(initialLead));
  const [title, setTitle] = useState(initialLead ? `Investigation: ${initialLead.lead_id} (${initialLead.entity_id})` : '');
  const [description, setDescription] = useState(initialLead ? initialLead.explanation : '');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>(initialLead?.risk_level || 'HIGH');
  const [targetEntity, setTargetEntity] = useState(initialLead?.entity_id || entities[0]?.entity_id || '');
  const [notes, setNotes] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    await createInvestigation({
      title,
      description,
      priority,
      entities: targetEntity ? [targetEntity] : [],
      transactions: initialLead ? [initialLead.txid] : [],
      notes
    });
    setShowNewModal(false);
    setTitle('');
    setDescription('');
    setNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0b1324]/90 rounded-2xl p-5 border border-[#172442] shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-amber-400" />
            Active Investigation Dossiers
          </h2>
          <p className="text-xs text-gray-400">Structured law-enforcement & analyst cases compiled from prioritized leads</p>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center text-xs font-bold text-gray-900 bg-amber-400 hover:bg-amber-300 px-4 py-2 rounded-xl shadow-md shadow-amber-500/10 transition-colors"
        >
          <PlusCircle className="w-4 h-4 mr-1.5" /> New Investigation
        </button>
      </div>

      {/* New Investigation Modal */}
      {showNewModal && (
        <div className="bg-[#0b1324] rounded-2xl p-6 border-2 border-amber-500/40 shadow-2xl space-y-4">
          <div className="flex justify-between items-center border-b border-[#172442] pb-3">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Create Investigation Case</h3>
            <button onClick={() => setShowNewModal(false)} className="text-xs text-gray-400 hover:text-gray-200">Close</button>
          </div>

          <form onSubmit={handleCreate} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-gray-300 mb-1">Case Title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g., High-Velocity Layering Pattern across ENT_BTC_001"
                className="w-full bg-[#0e172a] border border-[#1e2e50] focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-gray-200 outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-gray-300 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as any)}
                  className="w-full bg-[#0e172a] border border-[#1e2e50] focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-gray-200 outline-none"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-300 mb-1">Primary Entity</label>
                <input
                  type="text"
                  value={targetEntity}
                  onChange={e => setTargetEntity(e.target.value)}
                  placeholder="Entity ID (e.g., ENT_BTC_001)"
                  className="w-full bg-[#0e172a] border border-[#1e2e50] focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-gray-200 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-gray-300 mb-1">Description & Evidence</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                className="w-full bg-[#0e172a] border border-[#1e2e50] focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-gray-200 outline-none"
                placeholder="Observed anomalous patterns, peel chains, counterparty concentrations..."
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-300 mb-1">Analyst Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-[#0e172a] border border-[#1e2e50] focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-gray-200 outline-none"
                placeholder="Next steps, subpoenas, exchange freezing requests..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2 border border-[#1e2e50] bg-[#0e172a] text-gray-300 hover:text-white rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-gray-900 rounded-xl text-xs font-bold shadow-sm"
              >
                Save Dossier
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Investigations List */}
      <div className="space-y-4">
        {investigations.map(inv => {
          const isCrit = inv.priority === 'CRITICAL';
          const isHigh = inv.priority === 'HIGH';
          const isAuto = inv.created_by === 'V.E.C.T.O.R Auto';
          const hasFullData = (inv.discovered_entities_count || 0) > 0 || (inv.leads_count || 0) > 0;

          return (
            <div key={inv.investigation_id} className="bg-[#0b1324]/90 rounded-2xl p-5 border border-[#172442] shadow-lg space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs font-bold text-gray-400">{inv.investigation_id}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isCrit ? 'bg-red-500/20 text-red-400 border border-red-500/40' :
                      isHigh ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' :
                      'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    }`}>
                      {inv.priority} PRIORITY
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-semibold border border-cyan-500/30">
                      STATUS: {inv.investigation_status || inv.status}
                    </span>
                    {isAuto && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 font-semibold border border-purple-500/30 flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5" /> AUTO
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-white mt-1">{inv.title}</h3>
                </div>

                <div className="flex items-center gap-2">
                  {onViewInvestigation && (
                    <button
                      onClick={() => onViewInvestigation(inv.investigation_id)}
                      className="inline-flex items-center text-xs font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" /> View Investigation
                    </button>
                  )}
                  <div className="text-right text-xs text-gray-400 font-mono">
                    <Clock className="w-3.5 h-3.5 inline mr-1 text-gray-500" />
                    {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : 'Active'}
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed bg-[#0e172a] p-3 rounded-xl border border-[#1b2b4d]">
                {inv.description}
              </p>

              {/* Investigation Stats (for auto-generated investigations) */}
              {hasFullData && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {[
                    { label: 'Depth', value: `${inv.investigation_depth || 0} hops`, icon: Layers },
                    { label: 'Entities', value: inv.discovered_entities_count || 0, icon: Users },
                    { label: 'Transactions', value: inv.discovered_transactions_count || 0, icon: FileText },
                    { label: 'Patterns', value: inv.detected_patterns_count || 0, icon: ShieldAlert },
                    { label: 'Leads', value: inv.leads_count || 0, icon: Target },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-[#0e172a] rounded-lg p-2 border border-[#1b2b4d] flex items-center gap-2">
                      <stat.icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <div>
                        <div className="text-[10px] text-gray-400">{stat.label}</div>
                        <div className="text-xs font-bold text-white">{stat.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Trigger Reasons (for auto-generated investigations) */}
              {inv.trigger_reasons && inv.trigger_reasons.length > 0 && inv.trigger_reasons[0] !== 'manual_investigation' && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-gray-400 font-semibold mr-1">Triggers:</span>
                  {inv.trigger_reasons.map((reason: string, ri: number) => (
                    <span key={ri} className="text-[9px] px-2 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/20 font-medium">
                      {reason}
                    </span>
                  ))}
                </div>
              )}

              {inv.notes && (
                <div className="text-xs text-amber-300 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                  <strong className="text-amber-400">Analyst Notes:</strong> {inv.notes}
                </div>
              )}

              <div className="flex justify-between items-center pt-2 text-xs text-gray-400 border-t border-[#172442]">
                <div className="flex items-center gap-2">
                  <span>Seed Entity:</span>
                  {inv.seed_entity_id ? (
                    <span className="font-mono font-semibold text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 rounded text-[11px]">
                      {inv.seed_entity_id}
                    </span>
                  ) : (
                    (inv.entities || []).map((e: string) => (
                      <span key={e} className="font-mono font-semibold text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 rounded text-[11px]">
                        {e}
                      </span>
                    ))
                  )}
                </div>
                <span className="text-gray-400">Created by: <strong className="text-gray-200">{inv.created_by}</strong></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BitcoinInvestigations;

