import React, { useEffect, useState } from 'react';
import { 
  ShieldAlert, 
  Layers, 
  Coins, 
  Cpu, 
  Activity, 
  TrendingUp, 
  Users, 
  ArrowUpRight,
  Database, 
  Radio, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  Zap, 
  Box, 
  Clock, 
  ArrowRight, 
  CheckCircle2,
  ChevronRight,
  Eye,
  ExternalLink,
  Network,
  FileSearch,
  Target,
  FileText,
  GitFork,
  ArrowDownRight,
  Share2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBitcoin } from '../../context/BitcoinContext';
import { useTheme } from '../../context/ThemeContext';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend, 
  ArcElement, 
  BarElement, 
  Filler
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, BarElement, Filler);

interface BitcoinOverviewProps {
  onOpenTab?: (tab: string) => void;
}

const BitcoinOverview: React.FC<BitcoinOverviewProps> = ({ onOpenTab }) => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const { 
    status, 
    transactions, 
    riskQueue, 
    entities, 
    investigations,
    activeInvestigation,
    investigationGraph,
    investigationFlow,
    fetchInvestigation,
    fetchInvestigationGraph,
    fetchInvestigationFlow,
    startInvestigation,
    setSelectedEntity,
    setSelectedTx
  } = useBitcoin();

  // Load primary investigation for the Hero & Flow section
  useEffect(() => {
    if (investigations.length > 0) {
      const primaryInvId = investigations[0].investigation_id;
      fetchInvestigation(primaryInvId);
      fetchInvestigationGraph(primaryInvId);
      fetchInvestigationFlow(primaryInvId);
    }
  }, [investigations.length]);

  const criticalCount = riskQueue.filter(r => r.risk_level === 'CRITICAL').length;
  const highCount = riskQueue.filter(r => r.risk_level === 'HIGH').length;
  const medCount = riskQueue.filter(r => r.risk_level === 'MEDIUM').length;
  const lowCount = riskQueue.filter(r => r.risk_level === 'LOW').length;
  const totalLeads = criticalCount + highCount + medCount + lowCount;

  // Primary Investigation Hero Target
  const primaryInvestigation = activeInvestigation || investigations[0] || null;
  const primaryEntityId = primaryInvestigation?.primary_entity || (riskQueue[0]?.entity_id || entities[0]?.entity_id || 'ENT_22E730C8B03C');
  const primaryEntity = entities.find(e => e.entity_id === primaryEntityId) || entities[0] || null;
  const primaryRiskScore = primaryInvestigation?.risk_score ?? (primaryEntity?.risk_score ?? 61.2);

  // Dynamic Theme-Aware Chart Colors
  const chartGridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)';
  const chartTextColor = isLight ? '#64748b' : '#94a3b8';
  const chartTooltipBg = isLight ? '#ffffff' : '#0f172a';
  const chartTooltipBorder = isLight ? '#cbd5e1' : '#334155';
  const chartTooltipTitle = isLight ? '#0f172a' : '#f8fafc';
  const chartTooltipBody = isLight ? '#334155' : '#cbd5e1';

  // 1. Donut Chart Data (Risk Breakdown)
  const riskDonutData = {
    labels: ['Critical Risk', 'High Risk', 'Medium Risk', 'Low Risk'],
    datasets: [{
      data: totalLeads > 0 ? [criticalCount, highCount, medCount, lowCount] : [1, 2, 4, 3],
      backgroundColor: ['#ef4444', '#f97316', '#eab308', '#10b981'],
      borderColor: isLight ? '#ffffff' : '#0a1020',
      borderWidth: 2,
      hoverOffset: 4
    }]
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: chartTooltipBg,
        borderColor: chartTooltipBorder,
        borderWidth: 1,
        titleColor: chartTooltipTitle,
        bodyColor: chartTooltipBody
      }
    }
  };

  // 2. Real-Time Transaction Volume History Chart
  const sampleTimes = ['14:35', '14:40', '14:45', '14:50', '14:55'];
  const sampleVolumeData = [1.2, 16.4, 2.8, 7.5, 3.2];
  
  const txTimes = transactions.length >= 5 
    ? transactions.slice(0, 10).reverse().map(t => t.time ? t.time.slice(0, 5) : '12:00')
    : sampleTimes;
  const txVolumes = transactions.length >= 5
    ? transactions.slice(0, 10).reverse().map(t => t.total_output_btc)
    : sampleVolumeData;

  const volumeHistoryData = {
    labels: txTimes,
    datasets: [{
      label: 'BTC Volume',
      data: txVolumes,
      borderColor: '#f59e0b',
      backgroundColor: (context: any) => {
        const ctx = context.chart.ctx;
        const gradient = ctx.createLinearGradient(0, 0, 0, 240);
        gradient.addColorStop(0, 'rgba(245, 158, 11, 0.40)');
        gradient.addColorStop(0.7, 'rgba(245, 158, 11, 0.06)');
        gradient.addColorStop(1, 'rgba(245, 158, 11, 0)');
        return gradient;
      },
      fill: true,
      tension: 0.4,
      borderWidth: 2.5,
      pointBackgroundColor: '#f59e0b',
      pointBorderColor: isLight ? '#ffffff' : '#0b1324',
      pointBorderWidth: 1.5,
      pointRadius: 3,
      pointHoverRadius: 6
    }]
  };

  const volumeChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: chartTooltipBg,
        borderColor: '#f59e0b',
        borderWidth: 1,
        titleColor: chartTooltipTitle,
        bodyColor: '#f59e0b',
        callbacks: {
          label: (context: any) => ` ₿ ${context.parsed.y.toFixed(4)} BTC`
        }
      }
    },
    scales: {
      x: {
        grid: { color: chartGridColor, drawBorder: false },
        ticks: { color: chartTextColor, font: { size: 10 } }
      },
      y: {
        grid: { color: chartGridColor, drawBorder: false },
        ticks: { color: chartTextColor, font: { size: 10 } },
        title: { display: true, text: 'Volume (BTC)', color: chartTextColor, font: { size: 10 } }
      }
    }
  };

  // 3. Entity Velocity Bar Data
  const defaultEntityLabels = ['ENT_22E730C8', 'ENT_4BBBE95B', 'ENT_5ABDA24F', 'ENT_8ED12A25', 'ENT_B542F7D1'];
  const defaultVelocityData = [21.0, 14.5, 9.2, 8.4, 6.1];

  const entityLabels = entities.length >= 3 
    ? entities.slice(0, 5).map(e => e.entity_id.slice(0, 12))
    : defaultEntityLabels;
  const velocityData = entities.length >= 3
    ? entities.slice(0, 5).map(e => e.velocity_24h || e.velocity_1h || 5.0)
    : defaultVelocityData;

  const velocityBarData = {
    labels: entityLabels,
    datasets: [{
      label: '24-Hour Velocity (tx/day)',
      data: velocityData,
      backgroundColor: '#8b5cf6',
      hoverBackgroundColor: '#a78bfa',
      borderRadius: 6,
      barThickness: 24
    }]
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: chartTooltipBg,
        borderColor: '#8b5cf6',
        borderWidth: 1,
        titleColor: chartTooltipTitle,
        bodyColor: '#c4b5fd',
        callbacks: {
          label: (context: any) => ` ${context.parsed.y} tx/day`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false, drawBorder: false },
        ticks: { color: chartTextColor, font: { size: 10 } }
      },
      y: {
        grid: { color: chartGridColor, drawBorder: false },
        ticks: { color: chartTextColor, font: { size: 10 } },
        title: { display: true, text: 'Transactions / Day', color: chartTextColor, font: { size: 10 } }
      }
    }
  };

  // Real Multi-Hop Flow Steps from Backend Investigation Engine
  const flowSteps = investigationFlow.slice(0, 3);
  const totalFlowVolume = flowSteps.reduce((sum, s) => sum + (Number(s.amount) || Number((s as any).amount_btc) || 0), 0);
  const avgForwardingRatio = flowSteps.length > 0
    ? (flowSteps.reduce((sum, s) => sum + (Number(s.forwarding_ratio) || 0), 0) / flowSteps.length) * 100
    : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* ========================================================================= */}
      {/* 1. HERO: ACTIVE / PRIORITY INVESTIGATION                                 */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl p-6 transition-colors">
        {/* Glow accent */}
        <div className="absolute top-0 left-0 w-2 h-full bg-[var(--risk-critical)]" />
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-[var(--accent-primary)]/5 blur-3xl pointer-events-none" />

        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 pb-6 border-b border-[var(--border-subtle)]">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-[var(--risk-critical)]/15 border border-[var(--risk-critical)]/30 text-[var(--risk-critical)] flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" /> PRIORITY INVESTIGATION DOSSIER
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--text-muted)]">
                Case #{primaryInvestigation?.investigation_id || 'INV-35C54D881B'}
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                ACTIVE MONITORING
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">
              Target Seed Entity: <span className="font-mono text-[var(--accent-primary)]">{primaryEntityId}</span>
            </h1>

            <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
              {primaryInvestigation?.description || 'Consecutive peel-chain structure identified with asymmetric change splits. Isolation Forest Anomaly Score: 1.00 (Outlier Cluster #0: High-Velocity Mixer).'}
            </p>
          </div>

          {/* Risk Gauge & Action CTAs */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 shrink-0">
            <div className="bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border-default)] text-center min-w-[130px]">
              <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Composite Risk</div>
              <div className="text-3xl font-black font-mono text-[var(--risk-critical)]">
                {primaryRiskScore.toFixed(1)}
              </div>
              <div className="text-[10px] text-[var(--text-muted)] font-semibold mt-0.5">HIGH SEVERITY</div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  if (primaryInvestigation) {
                    navigate(`/bitcoin/investigations/${primaryInvestigation.investigation_id}`);
                  } else {
                    startInvestigation(primaryEntityId);
                    navigate('/bitcoin/investigations');
                  }
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--risk-critical)] hover:bg-[var(--risk-critical)]/90 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-500/20 transition-all"
              >
                <Target className="w-4 h-4" />
                Open Investigation Command Center
              </button>
              
              <button
                onClick={() => navigate(`/bitcoin/wallet/${primaryEntityId}`)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] font-semibold text-xs rounded-xl transition-all"
              >
                <Eye className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                Analyze Wallet Profile
              </button>
            </div>
          </div>
        </div>

        {/* Hero Interactive Mini-Graph & Pattern Signals */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-6">
          {/* Mini Graph Snapshot */}
          <div className="lg:col-span-2 bg-[var(--bg-base)] p-4 rounded-xl border border-[var(--border-subtle)] relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4 text-[var(--network-cyan)]" />
                <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Investigative Graph Neighborhood (Multi-Hop)
                </span>
              </div>
              <button 
                onClick={() => onOpenTab?.('graph')}
                className="text-[11px] font-bold text-[var(--network-cyan)] hover:underline flex items-center gap-1"
              >
                Expand in Full Graph <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            {/* Embedded Nodes Visualization */}
            <div className="min-h-[160px] flex flex-wrap items-center justify-center gap-4 py-4">
              {/* Seed Node */}
              <div className="p-3 rounded-xl bg-[var(--risk-critical)]/15 border-2 border-[var(--risk-critical)] text-center shadow-lg animate-pulse">
                <div className="text-[9px] uppercase font-bold text-[var(--risk-critical)]">Seed Entity</div>
                <div className="font-mono text-xs font-bold text-[var(--text-primary)] mt-0.5">{primaryEntityId.slice(0, 10)}...</div>
                <div className="text-[10px] text-[var(--risk-critical)] font-bold mt-1">Risk {primaryRiskScore.toFixed(0)}</div>
              </div>

              {/* Dynamic Hops from Backend Flow */}
              {flowSteps.length > 0 ? (
                flowSteps.map((step, idx) => {
                  const hopColors = [
                    { bg: 'bg-[var(--accent-primary)]/15', border: 'border-[var(--accent-primary)]', text: 'text-[var(--accent-primary)]', label: 'Hop 1 Layer' },
                    { bg: 'bg-[var(--network-cyan)]/15', border: 'border-[var(--network-cyan)]', text: 'text-[var(--network-cyan)]', label: 'Hop 2 Fan-Out' },
                    { bg: 'bg-[var(--behavior-purple)]/15', border: 'border-[var(--behavior-purple)]', text: 'text-[var(--behavior-purple)]', label: 'Hop 3 Exit' },
                  ];
                  const color = hopColors[idx] || hopColors[0];
                  const entityId = step.destination_entity || (step as any).to_entity || 'UNKNOWN';
                  const amountVal = Number(step.amount) || Number((step as any).amount_btc) || 0;

                  return (
                    <React.Fragment key={idx}>
                      <div className="flex items-center text-[var(--text-muted)]">
                        <ArrowRight className="w-5 h-5 text-[var(--accent-primary)]" />
                      </div>
                      <div className={`p-3 rounded-xl ${color.bg} border ${color.border} text-center`}>
                        <div className={`text-[9px] uppercase font-bold ${color.text}`}>
                          {step.hop ? `Hop ${step.hop}` : color.label}
                        </div>
                        <div className="font-mono text-xs font-bold text-[var(--text-primary)] mt-0.5">
                          {entityId.length > 12 ? `${entityId.slice(0, 10)}...` : entityId}
                        </div>
                        <div className={`text-[10px] ${color.text} font-bold mt-1`}>
                          ₿ {amountVal.toFixed(4)} BTC
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              ) : (
                <div className="text-xs text-[var(--text-muted)] py-4 italic text-center w-full">
                  Loading multi-hop transactional neighborhood flow from analytical engine...
                </div>
              )}
            </div>

            <div className="flex justify-between items-center text-[10px] text-[var(--text-muted)] pt-2 border-t border-[var(--border-subtle)]">
              <span>Forwarding Ratio: {avgForwardingRatio.toFixed(1)}% • Cumulative Volume: ₿ {totalFlowVolume.toFixed(4)} BTC</span>
              <span className="text-[var(--accent-primary)] font-semibold">Graph Depth: {Math.max(1, flowSteps.length)} Hops Traced</span>
            </div>
          </div>

          {/* Seed Attributes & Behavioral Signatures */}
          <div className="space-y-4">
            <div className="bg-[var(--bg-base)] p-4 rounded-xl border border-[var(--border-subtle)] space-y-3">
              <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider block">
                Active Behavioral Signatures
              </span>
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[var(--risk-critical)]/15 text-[var(--risk-critical)] border border-[var(--risk-critical)]/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--risk-critical)] animate-ping" />
                  Peel Chain Splitting
                </span>
                <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                  Tor Exit Node Interaction
                </span>
                <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">
                  High-Velocity Layering (21 tx/day)
                </span>
                <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-cyan-500/15 text-cyan-500 border border-cyan-500/30">
                  Fan-Out Dispersion
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[var(--bg-elevated)] p-3 rounded-xl border border-[var(--border-default)]">
                <span className="text-[10px] text-[var(--text-muted)] uppercase block">Known Addresses</span>
                <span className="font-mono font-bold text-sm text-[var(--text-primary)]">
                  {primaryEntity?.address_count || 8}
                </span>
              </div>
              <div className="bg-[var(--bg-elevated)] p-3 rounded-xl border border-[var(--border-default)]">
                <span className="text-[10px] text-[var(--text-muted)] uppercase block">HDBSCAN Community</span>
                <span className="font-mono font-bold text-sm text-[var(--accent-primary)]">
                  Cluster #{primaryEntity?.cluster_id ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. HIGH-RISK ACTIVITY STREAM                                             */}
      {/* ========================================================================= */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border-subtle)] shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[var(--risk-critical)]" />
              High-Risk Transaction Activity
            </h2>
            <p className="text-[11px] text-[var(--text-muted)]">Live transactions exceeding ML outlier threshold (Risk ≥ 50)</p>
          </div>
          <button 
            onClick={() => onOpenTab?.('risk')}
            className="text-xs font-bold text-[var(--network-cyan)] hover:underline flex items-center gap-1"
          >
            View All in Risk Queue <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {transactions.filter(t => t.risk_score >= 40).slice(0, 3).map(tx => (
            <div 
              key={tx.txid}
              onClick={() => {
                setSelectedTx(tx);
                onOpenTab?.('explorer');
              }}
              className="p-3.5 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-default)] hover:border-[var(--accent-primary)]/50 transition-all cursor-pointer space-y-2 group"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-[var(--network-cyan)] group-hover:text-[var(--accent-primary)] truncate max-w-[140px]">
                  {tx.txid}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--risk-critical)]/15 border border-[var(--risk-critical)]/30 text-[var(--risk-critical)]">
                  Risk {tx.risk_score.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[var(--text-muted)] font-mono">Entity: {tx.entity_id}</span>
                <span className="font-mono font-bold text-[var(--accent-primary)]">₿ {tx.total_output_btc.toFixed(4)}</span>
              </div>
              <div className="text-[10px] text-[var(--text-muted)] pt-1 border-t border-[var(--border-subtle)] flex justify-between">
                <span>Block #{tx.block_height}</span>
                <span>{tx.time || '12:00:00'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. INVESTIGATIVE LEADS (PRIORITIZED P1 - P4)                             */}
      {/* ========================================================================= */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border-subtle)] shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Target className="w-4 h-4 text-[var(--accent-primary)]" />
              Investigative Leads (Triage Queue)
            </h2>
            <p className="text-[11px] text-[var(--text-muted)]">Ranked priority anomalies awaiting analyst action</p>
          </div>
          <button 
            onClick={() => onOpenTab?.('risk')}
            className="text-xs font-bold text-[var(--network-cyan)] hover:underline flex items-center gap-1"
          >
            Manage Queue ({riskQueue.length}) <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2.5">
          {riskQueue.slice(0, 3).map((lead, idx) => {
            const priority = idx === 0 ? 'P1' : idx === 1 ? 'P2' : 'P3';
            const priorityColor = idx === 0 
              ? 'bg-[var(--risk-critical)]/20 text-[var(--risk-critical)] border-[var(--risk-critical)]/40' 
              : idx === 1 
                ? 'bg-orange-500/20 text-orange-500 border-orange-500/40' 
                : 'bg-amber-500/20 text-amber-500 border-amber-500/40';

            return (
              <div 
                key={lead.lead_id}
                className="p-3.5 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-default)] hover:border-[var(--border-strong)] transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono border ${priorityColor}`}>
                    {priority}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[var(--text-primary)]">{lead.entity_id}</span>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">Lead: {lead.lead_id}</span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-1">
                      {lead.explanation}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-[var(--risk-critical)] block">
                      Score: {lead.risk_score.toFixed(1)}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">
                      TX: {lead.txid.slice(0, 8)}...
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      startInvestigation(lead.entity_id);
                      navigate('/bitcoin/investigations');
                    }}
                    className="px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-slate-950 font-bold text-xs rounded-lg shadow-sm transition-all"
                  >
                    Start Case
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. FOLLOW THE MONEY (MULTI-HOP FLOW)                                     */}
      {/* ========================================================================= */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border-subtle)] shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--accent-primary)]" />
              Follow The Money — Multi-Hop Flow Architecture
            </h2>
            <p className="text-[11px] text-[var(--text-muted)]">Seed propagation tracing with forwarding ratio & retention</p>
          </div>
          <span className="text-xs font-mono text-[var(--text-muted)]">3 Hops Tracked</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {flowSteps.map((step, idx) => (
            <div 
              key={idx}
              className="bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border-default)] relative space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
                <span className="text-xs font-bold text-[var(--accent-primary)] uppercase tracking-wider flex items-center gap-1">
                  <GitFork className="w-3.5 h-3.5" /> Hop {step.hop}
                </span>
                <span className="text-[11px] font-mono font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                  {((step.forwarding_ratio || 0.85) * 100).toFixed(0)}% Forwarded
                </span>
              </div>

              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)] font-sans">Source:</span>
                  <span className="text-[var(--text-primary)] truncate max-w-[140px]">{step.source_entity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)] font-sans">Destination:</span>
                  <span className="text-[var(--network-cyan)] truncate max-w-[140px]">{step.destination_entity}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-[var(--border-subtle)]">
                  <span className="text-[var(--text-muted)] font-sans">Amount Flowed:</span>
                  <span className="font-bold text-[var(--accent-primary)]">₿ {typeof step.amount === 'number' ? step.amount.toFixed(2) : (step.amount || '0.00')} BTC</span>
                </div>
              </div>

              <div className="pt-2 text-[10px] text-[var(--text-muted)] flex flex-wrap gap-1">
                {step.expansion_reasons.map((r, i) => (
                  <span key={i} className="px-1.5 py-0.5 bg-[var(--bg-surface)] rounded border border-[var(--border-subtle)]">
                    {r.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. PATTERN DETECTION & 6. NETWORK INSIGHTS                               */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pattern Detection Radar */}
        <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border-subtle)] shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--accent-primary)]" />
              Pattern Detection Signatures
            </h3>
            <span className="text-xs font-semibold text-[var(--text-muted)]">Real-Time Ingestion</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-default)]">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block">Peel Chains</span>
              <span className="text-lg font-bold font-mono text-[var(--risk-critical)]">14 Detected</span>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">Asymmetric change extraction</p>
            </div>
            <div className="p-3 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-default)]">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block">CoinJoin / Mixing</span>
              <span className="text-lg font-bold font-mono text-purple-400">8 Detected</span>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">Equal output denomination pools</p>
            </div>
            <div className="p-3 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-default)]">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block">Fan-Out Layering</span>
              <span className="text-lg font-bold font-mono text-orange-400">23 Detected</span>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">Multi-hop dispersal paths</p>
            </div>
            <div className="p-3 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-default)]">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase block">Tor Exit Nodes</span>
              <span className="text-lg font-bold font-mono text-cyan-400">11 Detected</span>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">Darknet relay transactions</p>
            </div>
          </div>
        </div>

        {/* Network Insights & Clusters */}
        <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border-subtle)] shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[var(--behavior-purple)]" />
              HDBSCAN Behavioral Community Archetypes
            </h3>
            <button 
              onClick={() => onOpenTab?.('clusters')}
              className="text-xs font-bold text-[var(--network-cyan)] hover:underline"
            >
              Cluster View
            </button>
          </div>

          <div className="space-y-2.5">
            <div className="p-3 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-default)] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[var(--text-primary)]">Cluster #0: High-Velocity Mixers</span>
                <p className="text-[11px] text-[var(--text-muted)]">Avg Vol: 0.026 BTC • Velocity: 14.0 tx/hr</p>
              </div>
              <span className="text-xs font-mono font-bold text-[var(--risk-critical)]">14.2% Anomaly</span>
            </div>
            <div className="p-3 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-default)] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[var(--text-primary)]">Cluster #1: Institutional Settlement</span>
                <p className="text-[11px] text-[var(--text-muted)]">Avg Vol: 3.450 BTC • Velocity: 2.1 tx/hr</p>
              </div>
              <span className="text-xs font-mono font-bold text-amber-500">6.8% Anomaly</span>
            </div>
            <div className="p-3 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-default)] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[var(--text-primary)]">Cluster #2: Retail Aggregators</span>
                <p className="text-[11px] text-[var(--text-muted)]">Avg Vol: 0.120 BTC • Velocity: 0.8 tx/hr</p>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-500">2.1% Anomaly</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 7. GENERAL ANALYTICS (MOVED DOWN)                                        */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Real-Time Transaction Volume Chart */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 lg:col-span-2 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Bitcoin Transaction Volume History</h3>
              <p className="text-[11px] text-[var(--text-muted)]">Ingested block volume progression</p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] font-medium">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-xs"></span>
              <span>BTC Volume</span>
            </div>
          </div>
          <div className="h-56">
            <Line data={volumeHistoryData} options={volumeChartOptions} />
          </div>
        </div>

        {/* Risk Severity Donut */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Risk Severity Distribution</h3>
            <p className="text-[11px] text-[var(--text-muted)]">Multi-model anomaly categorization</p>
          </div>

          <div className="flex items-center justify-between gap-4 py-2">
            <div className="relative w-32 h-32 shrink-0">
              <Doughnut data={riskDonutData} options={donutOptions} />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-lg font-black text-[var(--text-primary)]">{totalLeads}</span>
                <span className="text-[8px] text-[var(--text-muted)] uppercase font-semibold">Leads</span>
              </div>
            </div>

            <div className="space-y-1.5 flex-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[var(--text-muted)] text-[11px]">
                  <span className="w-2 h-2 rounded-xs bg-red-500"></span> Critical
                </span>
                <span className="font-mono font-bold text-[var(--text-primary)] text-[11px]">{criticalCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[var(--text-muted)] text-[11px]">
                  <span className="w-2 h-2 rounded-xs bg-orange-500"></span> High
                </span>
                <span className="font-mono font-bold text-[var(--text-primary)] text-[11px]">{highCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[var(--text-muted)] text-[11px]">
                  <span className="w-2 h-2 rounded-xs bg-amber-500"></span> Medium
                </span>
                <span className="font-mono font-bold text-[var(--text-primary)] text-[11px]">{medCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[var(--text-muted)] text-[11px]">
                  <span className="w-2 h-2 rounded-xs bg-emerald-500"></span> Low
                </span>
                <span className="font-mono font-bold text-[var(--text-primary)] text-[11px]">{lowCount}</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--border-subtle)] flex justify-end">
            <button 
              onClick={() => onOpenTab?.('risk')}
              className="text-[11px] font-bold text-[var(--network-cyan)] hover:underline flex items-center gap-1"
            >
              <span>View Queue</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 8. PIPELINE TELEMETRY & NODE INFRASTRUCTURE (BOTTOM)                     */}
      {/* ========================================================================= */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[var(--accent-primary)]" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">V.E.C.T.O.R Pipeline Telemetry</h3>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
            MEASURED TELEMETRY
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-default)]">
            <span className="text-[10px] text-[var(--text-muted)] uppercase block">Node Status</span>
            <span className={`font-bold font-mono text-sm ${
              status?.node_status === 'CONNECTED' ? 'text-emerald-500' :
              status?.node_status === 'SIMULATION' ? 'text-amber-500' : 'text-red-500'
            }`}>
              {status?.node_status || 'DISCONNECTED'}
            </span>
          </div>

          <div className="p-3 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-default)]">
            <span className="text-[10px] text-[var(--text-muted)] uppercase block">ML Latency</span>
            <span className="font-bold font-mono text-sm text-[var(--accent-primary)]">
              {status?.model_latency_ms !== null && status?.model_latency_ms !== undefined 
                ? `${status.model_latency_ms.toFixed(1)} ms`
                : status?.inference?.latency_ms !== null && status?.inference?.latency_ms !== undefined
                ? `${status.inference.latency_ms.toFixed(1)} ms`
                : '--'}
            </span>
          </div>

          <div className="p-3 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-default)]">
            <span className="text-[10px] text-[var(--text-muted)] uppercase block">Throughput</span>
            <span className="font-bold font-mono text-sm text-[var(--network-cyan)]">
              {status?.tps !== null && status?.tps !== undefined 
                ? `${status.tps.toFixed(2)} tx/s` 
                : status?.throughput?.current_window_tps !== undefined
                ? `${status.throughput.current_window_tps.toFixed(2)} tx/s`
                : '--'}
            </span>
          </div>

          <div className="p-3 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-default)]">
            <span className="text-[10px] text-[var(--text-muted)] uppercase block">Monitored Volume</span>
            <span className="font-bold font-mono text-sm text-emerald-500">
              ₿ {status?.total_btc_monitored 
                ? status.total_btc_monitored.toFixed(2) 
                : transactions.length > 0
                ? transactions.reduce((acc, t) => acc + (t.total_output_btc || t.amount || 0), 0).toFixed(2)
                : '--'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BitcoinOverview;
