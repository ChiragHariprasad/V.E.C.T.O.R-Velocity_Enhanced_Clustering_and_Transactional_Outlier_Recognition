import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  AlertTriangle,
  Shield,
  Network,
  ChevronRight,
  Target,
  Activity,
  Users,
  Coins,
  Clock,
  FileText,
  Layers,
  ShieldAlert,
  TrendingUp,
  Eye,
  Zap,
  ArrowDown,
} from 'lucide-react';
import { useBitcoin } from '../../context/BitcoinContext';
import {
  InvestigationGraphNode,
  InvestigationGraphEdge,
  InvestigationFlowStep,
  InvestigationLead,
  InvestigationPattern,
} from '../../types/bitcoin';

interface Props {
  investigationId: string;
  onBack: () => void;
}

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  SOURCE: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/40' },
  INTERMEDIARY: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40' },
  CONSOLIDATION: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/40' },
  LAYERING: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40' },
  DISPERSAL: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/40' },
  CONVERGENCE: { bg: 'bg-teal-500/20', text: 'text-teal-400', border: 'border-teal-500/40' },
  EXIT_CANDIDATE: { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/40' },
  UNKNOWN: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/40' },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  P1: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40' },
  P2: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/40' },
  P3: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/40' },
  P4: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/40' },
};

const BitcoinInvestigationView: React.FC<Props> = ({ investigationId, onBack }) => {
  const {
    activeInvestigation,
    investigationGraph,
    investigationFlow,
    investigationLeads,
    fetchInvestigation,
    fetchInvestigationGraph,
    fetchInvestigationFlow,
    fetchInvestigationLeads,
  } = useBitcoin();

  const [activeSection, setActiveSection] = useState<'graph' | 'flow' | 'patterns' | 'leads' | 'evidence'>('graph');
  const [selectedNode, setSelectedNode] = useState<InvestigationGraphNode | null>(null);
  const [hopFilter, setHopFilter] = useState<number>(3);

  useEffect(() => {
    fetchInvestigation(investigationId);
    fetchInvestigationGraph(investigationId);
    fetchInvestigationFlow(investigationId);
    fetchInvestigationLeads(investigationId);
  }, [investigationId]);

  if (!activeInvestigation) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Activity className="w-10 h-10 text-amber-400 mx-auto mb-3 animate-pulse" />
          <p className="text-sm text-gray-400">Loading investigation data...</p>
        </div>
      </div>
    );
  }

  const inv = activeInvestigation;
  const evidence = inv.evidence;
  const seedAnalysis = inv.seed_analysis || {};

  const statusColor = inv.investigation_status === 'COMPLETED'
    ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
    : inv.investigation_status === 'ANALYZING'
    ? 'text-amber-400 bg-amber-500/15 border-amber-500/30 animate-pulse'
    : 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30';

  const filteredEdges = investigationGraph.edges.filter(e => e.hop <= hopFilter);
  const visibleNodeIds = new Set<string>();
  filteredEdges.forEach(e => { visibleNodeIds.add(e.source); visibleNodeIds.add(e.target); });
  // Always show seed
  investigationGraph.nodes.forEach(n => { if (n.is_seed) visibleNodeIds.add(n.id); });
  const filteredNodes = investigationGraph.nodes.filter(n => visibleNodeIds.has(n.id));

  const sections = [
    { id: 'graph', label: 'Investigation Graph', icon: Network },
    { id: 'flow', label: 'Money Flow', icon: TrendingUp },
    { id: 'patterns', label: 'Patterns', icon: Layers },
    { id: 'leads', label: 'Leads', icon: Target },
    { id: 'evidence', label: 'Evidence', icon: FileText },
  ];

  return (
    <div className="space-y-5">
      {/* ===== Investigation Header ===== */}
      <div className="bg-[#0b1324]/90 rounded-2xl p-5 border border-[#172442] shadow-lg">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
          <div>
            <button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-200 mb-2 flex items-center gap-1">
              <ChevronRight className="w-3 h-3 rotate-180" /> Back to Investigations
            </button>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-400" />
              Investigation: <span className="font-mono text-amber-400">{inv.investigation_id}</span>
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Seed Entity: <span className="font-mono text-indigo-300">{inv.seed_entity_id}</span>
              {inv.seed_transaction_id && (
                <> • TX: <span className="font-mono text-gray-300">{inv.seed_transaction_id.slice(0, 16)}...</span></>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg border ${statusColor}`}>
              {inv.investigation_status}
            </span>
            <span className="text-[10px] font-bold text-gray-300 bg-[#0e172a] border border-[#1e2e50] px-2.5 py-1 rounded-lg">
              Depth: {inv.investigation_depth} hops
            </span>
            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
              Risk: {inv.initial_risk_score}
            </span>
          </div>
        </div>

        {/* Trigger Reasons */}
        {inv.trigger_reasons.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="text-[10px] text-gray-400 font-semibold mr-1">Triggers:</span>
            {inv.trigger_reasons.map((reason, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/20 font-medium">
                {reason}
              </span>
            ))}
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
          {[
            { label: 'Entities', value: inv.discovered_entities?.length || 0, icon: Users, color: 'text-indigo-400' },
            { label: 'Transactions', value: inv.discovered_transactions?.length || 0, icon: Activity, color: 'text-cyan-400' },
            { label: 'Patterns', value: inv.detected_patterns?.length || 0, icon: Layers, color: 'text-amber-400' },
            { label: 'Leads', value: inv.final_leads?.length || 0, icon: Target, color: 'text-red-400' },
            { label: 'Flow Steps', value: inv.flow_path?.length || 0, icon: TrendingUp, color: 'text-emerald-400' },
          ].map((stat) => (
            <div key={stat.label} className="bg-[#0e172a] rounded-xl p-3 border border-[#1b2b4d] text-center">
              <stat.icon className={`w-4 h-4 mx-auto mb-1 ${stat.color}`} />
              <div className="text-lg font-bold text-white">{stat.value}</div>
              <div className="text-[10px] text-gray-400 font-semibold uppercase">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== Section Tabs ===== */}
      <div className="flex gap-1.5 bg-[#0b1222]/90 border border-[#17223b] rounded-xl p-1.5 overflow-x-auto no-scrollbar">
        {sections.map(s => {
          const Icon = s.icon;
          const isActive = activeSection === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id as any)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.03]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* ===== Section: Investigation Graph ===== */}
      {activeSection === 'graph' && (
        <div className="space-y-4">
          {/* Hop Filter */}
          <div className="bg-[#0b1324]/90 rounded-2xl p-4 border border-[#172442] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-white">Investigation Graph</span>
              <span className="text-[10px] text-gray-400">
                {filteredNodes.length} nodes • {filteredEdges.length} edges
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400">Max Hop:</span>
              {[1, 2, 3].map(h => (
                <button
                  key={h}
                  onClick={() => setHopFilter(h)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                    hopFilter === h
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : 'bg-[#0e172a] text-gray-400 border-[#1e2e50] hover:text-gray-200'
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          {/* Graph Canvas */}
          <div className="bg-gray-900 rounded-2xl p-6 min-h-[400px] border border-gray-800 relative">
            {/* Legend */}
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(ROLE_COLORS).map(([role, colors]) => (
                <span key={role} className={`text-[9px] font-bold px-2 py-0.5 rounded ${colors.bg} ${colors.text} border ${colors.border}`}>
                  {role}
                </span>
              ))}
            </div>

            {/* Nodes */}
            <div className="flex flex-wrap justify-center items-center gap-6 py-8">
              {filteredNodes.length === 0 ? (
                <div className="text-center text-gray-500">
                  <Network className="w-12 h-12 text-gray-700 mx-auto mb-2" />
                  <p className="text-xs">No graph data available for this investigation.</p>
                </div>
              ) : (
                filteredNodes.map((node) => {
                  const roleStyle = ROLE_COLORS[node.role] || ROLE_COLORS.UNKNOWN;
                  const isSelected = selectedNode?.id === node.id;
                  const riskIntensity = node.risk_score >= 75 ? 'ring-red-500' : node.risk_score >= 50 ? 'ring-orange-500' : 'ring-transparent';

                  return (
                    <button
                      key={node.id}
                      onClick={() => setSelectedNode(node)}
                      className={`p-3 rounded-xl transition-all duration-200 border flex flex-col gap-1.5 shadow-lg transform hover:scale-105 min-w-[130px] ${roleStyle.bg} ${roleStyle.border} ${
                        isSelected ? `ring-2 ${riskIntensity} scale-110 z-20` : ''
                      } ${node.is_seed ? 'ring-2 ring-amber-500 shadow-amber-500/20' : ''}`}
                    >
                      {/* Role Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[9px] font-black tracking-wider uppercase ${roleStyle.text}`}>
                          {node.role}
                        </span>
                        {node.is_seed && (
                          <Zap className="w-3 h-3 text-amber-400" />
                        )}
                      </div>

                      {/* Entity ID */}
                      <div className="font-mono text-xs font-bold text-gray-200 truncate max-w-[120px]">
                        {node.id.slice(0, 12)}
                      </div>

                      {/* Risk */}
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-gray-400">Risk</span>
                        <span className={`font-bold ${
                          node.risk_score >= 75 ? 'text-red-400' : node.risk_score >= 50 ? 'text-orange-400' : 'text-emerald-400'
                        }`}>
                          {node.risk_score.toFixed(0)}
                        </span>
                      </div>

                      {/* TX Count */}
                      <div className="text-[10px] text-gray-400">
                        {node.tx_count} txs
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Edges Summary */}
            {filteredEdges.length > 0 && (
              <div className="border-t border-gray-800 pt-3 mt-4 space-y-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Flow Edges:</span>
                {filteredEdges.map((edge, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] text-gray-300 bg-[#0e172a] px-3 py-1.5 rounded-lg border border-[#1b2b4d]">
                    <span className="font-mono text-indigo-300">{edge.source.slice(0, 10)}</span>
                    <ArrowRight className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="font-mono text-indigo-300">{edge.target.slice(0, 10)}</span>
                    <span className="text-amber-400 font-bold ml-auto">₿ {edge.amount.toFixed(4)}</span>
                    <span className="text-gray-500">hop {edge.hop}</span>
                    <span className="text-gray-500">{edge.flow_percentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Node Inspector */}
          {selectedNode && (
            <div className="bg-[#0b1324]/90 rounded-2xl p-5 border border-[#172442] shadow-lg space-y-3">
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider border-b border-[#172442] pb-2">
                Node Inspector
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[#0e172a] p-2.5 rounded-lg border border-[#1b2b4d]">
                  <span className="text-[10px] text-gray-400 block">Entity</span>
                  <span className="text-xs font-mono font-bold text-gray-200 break-all">{selectedNode.id}</span>
                </div>
                <div className="bg-[#0e172a] p-2.5 rounded-lg border border-[#1b2b4d]">
                  <span className="text-[10px] text-gray-400 block">Role</span>
                  <span className={`text-xs font-bold uppercase ${(ROLE_COLORS[selectedNode.role] || ROLE_COLORS.UNKNOWN).text}`}>{selectedNode.role}</span>
                </div>
                <div className="bg-[#0e172a] p-2.5 rounded-lg border border-[#1b2b4d]">
                  <span className="text-[10px] text-gray-400 block">Direct Risk</span>
                  <span className="text-xs font-bold text-red-400">{(selectedNode.direct_risk * 100).toFixed(1)}%</span>
                </div>
                <div className="bg-[#0e172a] p-2.5 rounded-lg border border-[#1b2b4d]">
                  <span className="text-[10px] text-gray-400 block">Propagated Risk</span>
                  <span className="text-xs font-bold text-orange-400">{(selectedNode.propagated_risk * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== Section: Money Flow Timeline ===== */}
      {activeSection === 'flow' && (
        <div className="space-y-4">
          <div className="bg-[#0b1324]/90 rounded-2xl p-4 border border-[#172442]">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white">Follow-the-Money Flow Path</span>
              <span className="text-[10px] text-gray-400">{investigationFlow.length} steps</span>
            </div>

            {investigationFlow.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <TrendingUp className="w-10 h-10 mx-auto mb-2 text-gray-700" />
                <p className="text-xs">No flow path data available.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Seed Entity Start */}
                <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="text-xs">
                    <span className="text-amber-400 font-bold">SEED ENTITY: </span>
                    <span className="font-mono text-gray-200">{inv.seed_entity_id}</span>
                    <span className="text-gray-400 ml-2">
                      (Risk: {inv.initial_risk_score}, Outflow: ₿ {seedAnalysis.total_outflow?.toFixed(4) || '—'})
                    </span>
                  </div>
                </div>

                {/* Flow Steps */}
                {investigationFlow.map((step, i) => (
                  <div key={i} className="relative">
                    {/* Connecting Line */}
                    <div className="absolute left-5 -top-3 w-px h-3 bg-[#1e2e50]" />
                    <ArrowDown className="w-3 h-3 text-gray-500 mx-auto mb-1" />

                    <div className="bg-[#0e172a] rounded-xl p-4 border border-[#1b2b4d] hover:border-amber-500/30 transition-colors">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[9px] font-bold text-gray-400 bg-[#172442] px-2 py-0.5 rounded uppercase">
                            Hop {step.hop}
                          </span>
                          <span className="font-mono text-xs text-indigo-300">{step.source_entity.slice(0, 10)}</span>
                          <ArrowRight className="w-3 h-3 text-amber-400" />
                          <span className="font-mono text-xs text-indigo-300">{step.destination_entity.slice(0, 10)}</span>
                        </div>
                        <span className="text-xs font-bold text-amber-400">₿ {step.amount.toFixed(4)}</span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-[10px]">
                        <div>
                          <span className="text-gray-500">Fwd Ratio: </span>
                          <span className={`font-bold ${step.forwarding_ratio >= 0.85 ? 'text-red-400' : step.forwarding_ratio >= 0.5 ? 'text-orange-400' : 'text-gray-300'}`}>
                            {(step.forwarding_ratio * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">% of Seed: </span>
                          <span className="text-gray-300 font-bold">{step.pct_of_seed.toFixed(1)}%</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Via: </span>
                          <span className="font-mono text-gray-300">{step.via_address.slice(0, 10)}...</span>
                        </div>
                        <div>
                          <span className="text-gray-500">TX: </span>
                          <span className="font-mono text-gray-300">{step.transaction_id.slice(0, 10)}...</span>
                        </div>
                      </div>

                      {step.expansion_reasons.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {step.expansion_reasons.map((r, ri) => (
                            <span key={ri} className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                              {r}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Section: Detected Patterns ===== */}
      {activeSection === 'patterns' && (
        <div className="space-y-3">
          <div className="bg-[#0b1324]/90 rounded-2xl p-4 border border-[#172442]">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-white">Detected Patterns</span>
              <span className="text-[10px] text-gray-400">{(inv.detected_patterns || []).length} patterns</span>
            </div>

            {(inv.detected_patterns || []).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Layers className="w-10 h-10 mx-auto mb-2 text-gray-700" />
                <p className="text-xs">No patterns detected in this investigation.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {inv.detected_patterns.map((pattern: InvestigationPattern, i: number) => (
                  <div key={i} className="bg-[#0e172a] rounded-xl p-4 border border-[#1b2b4d] space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={`w-3.5 h-3.5 ${pattern.confidence === 'HIGH' ? 'text-red-400' : 'text-amber-400'}`} />
                        <span className="text-xs font-bold text-white">{pattern.pattern_type}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                          pattern.confidence === 'HIGH'
                            ? 'bg-red-500/15 text-red-400 border-red-500/30'
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        }`}>
                          {pattern.confidence}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400">Hop {pattern.hop} • Severity {pattern.severity}</span>
                    </div>

                    <div className="flex flex-wrap gap-2 text-[10px]">
                      {pattern.involved_entities.map((e, ei) => (
                        <span key={ei} className="font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                          {e}
                        </span>
                      ))}
                      {pattern.involved_transactions.map((t, ti) => (
                        <span key={ti} className="font-mono text-gray-300 bg-gray-500/10 border border-gray-500/20 px-2 py-0.5 rounded">
                          TX:{t.slice(0, 10)}...
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Section: Ranked Leads ===== */}
      {activeSection === 'leads' && (
        <div className="space-y-3">
          <div className="bg-[#0b1324]/90 rounded-2xl p-4 border border-[#172442]">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-red-400" />
              <span className="text-xs font-bold text-white">Ranked Investigative Leads</span>
              <span className="text-[10px] text-gray-400">{investigationLeads.length} leads</span>
            </div>

            {investigationLeads.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Target className="w-10 h-10 mx-auto mb-2 text-gray-700" />
                <p className="text-xs">No investigative leads generated.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {investigationLeads.map((lead: InvestigationLead, i: number) => {
                  const priColors = PRIORITY_COLORS[lead.priority] || PRIORITY_COLORS.P4;
                  const roleColors = ROLE_COLORS[lead.role] || ROLE_COLORS.UNKNOWN;

                  return (
                    <div key={i} className="bg-[#0e172a] rounded-xl p-4 border border-[#1b2b4d] space-y-3 hover:border-amber-500/30 transition-colors">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${priColors.bg} ${priColors.text} ${priColors.border}`}>
                            {lead.priority}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${roleColors.bg} ${roleColors.text} ${roleColors.border}`}>
                            {lead.role}
                          </span>
                          <span className="font-mono text-xs font-bold text-gray-200">{lead.entity_id}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-[10px] text-gray-400">Composite Score</div>
                            <div className={`text-sm font-black ${lead.composite_score >= 75 ? 'text-red-400' : lead.composite_score >= 50 ? 'text-orange-400' : 'text-amber-400'}`}>
                              {lead.composite_score.toFixed(1)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Risk Bars */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                            <span>Direct Risk</span>
                            <span className="font-bold text-red-400">{(lead.direct_risk * 100).toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full transition-all" style={{ width: `${lead.direct_risk * 100}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                            <span>Propagated Risk</span>
                            <span className="font-bold text-orange-400">{(lead.propagated_risk * 100).toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all" style={{ width: `${lead.propagated_risk * 100}%` }} />
                          </div>
                        </div>
                      </div>

                      {/* Reasons */}
                      <div className="flex flex-wrap gap-1.5">
                        {lead.reasons.map((reason, ri) => (
                          <span key={ri} className="text-[9px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
                            {reason}
                          </span>
                        ))}
                      </div>

                      {/* Evidence Summary */}
                      <div className="flex items-center gap-4 text-[10px] text-gray-400 border-t border-[#172442] pt-2">
                        <span>{lead.evidence_summary.tx_count} txs</span>
                        <span>{lead.evidence_summary.detected_patterns} patterns</span>
                        <span>{lead.evidence_summary.downstream_hops} hops</span>
                        <span className="text-amber-400 font-bold">₿ {lead.evidence_summary.total_flow_btc.toFixed(4)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Section: Evidence & Explanation ===== */}
      {activeSection === 'evidence' && evidence && (
        <div className="space-y-4">
          {/* Trigger Evidence */}
          <div className="bg-[#0b1324]/90 rounded-2xl p-5 border border-[#172442] shadow-lg space-y-3">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> Investigation Trigger Evidence
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {(evidence.trigger || []).map((t: string, i: number) => (
                <span key={i} className="text-[10px] px-2.5 py-1 rounded-lg bg-red-500/10 text-red-300 border border-red-500/20 font-medium">
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Flow Evidence */}
          {evidence.flow_evidence && (
            <div className="bg-[#0b1324]/90 rounded-2xl p-5 border border-[#172442] shadow-lg space-y-3">
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Flow Evidence
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'Seed Amount', value: `₿ ${evidence.flow_evidence.seed_amount?.toFixed(4) || 0}` },
                  { label: 'Downstream', value: `₿ ${evidence.flow_evidence.downstream_amount?.toFixed(4) || 0}` },
                  { label: 'Hops', value: evidence.flow_evidence.hop_count || 0 },
                  { label: 'Avg Fwd Ratio', value: `${((evidence.flow_evidence.forwarding_ratio || 0) * 100).toFixed(1)}%` },
                  { label: 'Flow Steps', value: evidence.flow_evidence.total_flow_steps || 0 },
                ].map((item) => (
                  <div key={item.label} className="bg-[#0e172a] p-3 rounded-xl border border-[#1b2b4d] text-center">
                    <div className="text-xs font-bold text-white">{item.value}</div>
                    <div className="text-[9px] text-gray-400 uppercase">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Entity Evidence */}
          {evidence.entity_evidence && (
            <div className="bg-[#0b1324]/90 rounded-2xl p-5 border border-[#172442] shadow-lg space-y-3">
              <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4" /> Entity Evidence
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Discovered Entities', value: evidence.entity_evidence.total_discovered },
                  { label: 'Transactions', value: evidence.entity_evidence.total_transactions },
                  { label: 'Leads', value: evidence.entity_evidence.total_leads },
                  { label: 'Highest Lead Score', value: evidence.entity_evidence.highest_lead_score?.toFixed(1) },
                ].map((item) => (
                  <div key={item.label} className="bg-[#0e172a] p-3 rounded-xl border border-[#1b2b4d] text-center">
                    <div className="text-xs font-bold text-white">{item.value}</div>
                    <div className="text-[9px] text-gray-400 uppercase">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pattern Summary */}
          {evidence.patterns && evidence.patterns.length > 0 && (
            <div className="bg-[#0b1324]/90 rounded-2xl p-5 border border-[#172442] shadow-lg space-y-3">
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4" /> Detected Pattern Types
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {evidence.patterns.map((p: string, i: number) => (
                  <span key={i} className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Seed Analysis */}
          {Object.keys(seedAnalysis).length > 0 && (
            <div className="bg-[#0b1324]/90 rounded-2xl p-5 border border-[#172442] shadow-lg space-y-3">
              <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                <Eye className="w-4 h-4" /> Seed Entity Profile
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'TX Count', value: seedAnalysis.tx_count },
                  { label: 'Total Inflow', value: `₿ ${seedAnalysis.total_inflow?.toFixed(4) || 0}` },
                  { label: 'Total Outflow', value: `₿ ${seedAnalysis.total_outflow?.toFixed(4) || 0}` },
                  { label: 'Forwarding Ratio', value: `${((seedAnalysis.forwarding_ratio || 0) * 100).toFixed(1)}%` },
                  { label: 'Counterparties', value: seedAnalysis.counterparty_count },
                  { label: 'Velocity', value: `${seedAnalysis.tx_velocity?.toFixed(2) || 0} tx/hr` },
                  { label: 'Anomaly Score', value: seedAnalysis.anomaly_score?.toFixed(1) },
                  { label: 'Existing Risk', value: seedAnalysis.existing_risk_score?.toFixed(1) },
                ].map((item) => (
                  <div key={item.label} className="bg-[#0e172a] p-2.5 rounded-xl border border-[#1b2b4d]">
                    <div className="text-[10px] text-gray-400">{item.label}</div>
                    <div className="text-xs font-bold text-white">{item.value ?? '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BitcoinInvestigationView;
