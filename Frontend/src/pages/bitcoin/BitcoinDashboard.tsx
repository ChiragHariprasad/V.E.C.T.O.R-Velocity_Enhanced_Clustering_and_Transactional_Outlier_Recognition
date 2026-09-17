import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Home,
  Radio, 
  Search, 
  Users, 
  ShieldAlert, 
  Share2, 
  Layers, 
  TrendingUp, 
  FolderOpen,
  Cpu,
  Database,
  Sliders,
  ChevronRight,
  ArrowRight,
  Coins
} from 'lucide-react';
import BitcoinOverview from './BitcoinOverview';
import BitcoinLiveTransactions from './BitcoinLiveTransactions';
import BitcoinTransactionExplorer from './BitcoinTransactionExplorer';
import BitcoinAddressEntityExplorer from './BitcoinAddressEntityExplorer';
import BitcoinRiskQueue from './BitcoinRiskQueue';
import BitcoinTransactionGraph from './BitcoinTransactionGraph';
import BitcoinBehavioralClusters from './BitcoinBehavioralClusters';
import BitcoinAnomalyTimeline from './BitcoinAnomalyTimeline';
import BitcoinInvestigations from './BitcoinInvestigations';
import BitcoinInvestigationView from './BitcoinInvestigationView';
import { BitcoinTransaction, BitcoinRiskLead } from '../../types/bitcoin';
import { useBitcoin } from '../../context/BitcoinContext';

type Tab = 'overview' | 'live' | 'explorer' | 'entities' | 'risk' | 'graph' | 'clusters' | 'timeline' | 'investigations' | 'investigation-view' | 'models' | 'sources' | 'settings';

interface Props {
  initialTab?: Tab;
}

const BitcoinDashboard: React.FC<Props> = ({ initialTab = 'overview' }) => {
  const navigate = useNavigate();
  const { setSelectedTx, transactions, riskQueue } = useBitcoin();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [activeGraphTarget, setActiveGraphTarget] = useState<string | null>(null);
  const [activeLeadForCase, setActiveLeadForCase] = useState<BitcoinRiskLead | null>(null);
  const [activeInvestigationId, setActiveInvestigationId] = useState<string | null>(null);

  const handleSelectTx = (tx: BitcoinTransaction) => {
    setSelectedTx(tx);
    setActiveTab('explorer');
  };

  const handleOpenGraph = (id: string) => {
    setActiveGraphTarget(id);
    setActiveTab('graph');
  };

  const handleCreateCase = (lead: BitcoinRiskLead) => {
    setActiveLeadForCase(lead);
    setActiveTab('investigations');
  };

  const handleViewInvestigation = (investigationId: string) => {
    navigate(`/bitcoin/investigations/${investigationId}`);
  };

  const handleStartInvestigation = (entityId: string) => {
    navigate('/bitcoin/investigations');
  };

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleTabChange = (tabId: string) => {
    if (tabId === 'overview') navigate('/bitcoin');
    else navigate(`/bitcoin/${tabId}`);
  };

  const mainNavItems = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'live', label: 'Live Stream', icon: Radio },
    { id: 'explorer', label: 'TX Explorer', icon: Search },
    { id: 'entities', label: 'Entity Explorer', icon: Users },
    { id: 'risk', label: 'Risk Queue', icon: ShieldAlert, badge: riskQueue.length },
    { id: 'graph', label: 'Transaction Graph', icon: Share2 },
    { id: 'clusters', label: 'Behavioral Clusters', icon: Layers },
    { id: 'timeline', label: 'Anomaly Timeline', icon: TrendingUp },
    { id: 'investigations', label: 'Investigations', icon: FolderOpen }
  ];

  const systemNavItems = [
    { id: 'models', label: 'Model Performance', icon: Cpu },
    { id: 'sources', label: 'Data Sources', icon: Database },
    { id: 'settings', label: 'Settings', icon: Sliders }
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-5 pb-16">
      {/* Left Sidebar matching the reference screenshot */}
      <aside className="w-full lg:w-60 shrink-0 space-y-5">
        {/* Navigation Items Box */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-2.5 backdrop-blur-md">
          <nav className="space-y-1">
            {mainNavItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[var(--accent-primary)]/10 border-l-4 border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="bg-[var(--risk-critical)]/20 border border-[var(--risk-critical)]/40 text-[var(--risk-critical)] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* System Section */}
          <div className="mt-5 pt-4 border-t border-[var(--border-subtle)]">
            <p className="px-3.5 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              SYSTEM
            </p>
            <div className="space-y-1">
              {systemNavItems.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs transition-all ${
                      activeTab === item.id 
                        ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-bold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${activeTab === item.id ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Cyber Hexagonal Badge: FROM BLOCKCHAIN DATA TO INVESTIGATIVE INTELLIGENCE */}
        <div className="relative overflow-hidden bg-[var(--bg-elevated)] border border-[var(--network-cyan)]/30 rounded-2xl p-4 shadow-lg text-center">
          {/* Cyber glowing background grid accents */}
          <div className="absolute inset-0 bg-[radial-gradient(var(--network-cyan)_1px,transparent_1px)] [background-size:12px_12px] opacity-15 pointer-events-none"></div>
          
          <div className="relative z-10">
            <div className="w-8 h-8 mx-auto mb-2.5 rounded-lg bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 flex items-center justify-center text-[var(--accent-primary)]">
              <Coins className="w-4 h-4" />
            </div>
            <div className="text-[11px] font-black tracking-wider uppercase text-[var(--text-muted)]">
              FROM <span className="text-[var(--accent-primary)]">BLOCKCHAIN DATA</span>
            </div>
            <div className="text-[11px] font-black tracking-wider uppercase text-[var(--accent-primary)] mt-0.5">
              TO <span className="text-[var(--network-cyan)]">INVESTIGATIVE</span>
            </div>
            <div className="text-[11px] font-black tracking-wider uppercase text-[var(--network-cyan)] mt-0.5">
              INTELLIGENCE
            </div>

            <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-[10px] text-[var(--text-muted)]">
              <span className="font-mono font-bold tracking-widest text-[var(--text-primary)]">V . E . C . T . O . R</span>
              <span className="bg-[var(--bg-surface)] px-1.5 py-0.5 rounded text-[var(--text-muted)] font-mono border border-[var(--border-subtle)]">v2.0.0</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Right Main Content Area */}
      <main className="flex-1 min-w-0 space-y-6">
        {activeTab === 'overview' && <BitcoinOverview onOpenTab={(tab) => setActiveTab(tab as Tab)} />}
        {activeTab === 'live' && <BitcoinLiveTransactions onSelectTx={handleSelectTx} />}
        {activeTab === 'explorer' && <BitcoinTransactionExplorer onOpenGraph={handleOpenGraph} />}
        {activeTab === 'entities' && <BitcoinAddressEntityExplorer onSelectTx={handleSelectTx} onOpenGraph={handleOpenGraph} />}
        {activeTab === 'risk' && <BitcoinRiskQueue onSelectTx={handleSelectTx} onCreateCase={handleCreateCase} />}
        {activeTab === 'graph' && <BitcoinTransactionGraph initialNodeId={activeGraphTarget} />}
        {activeTab === 'clusters' && <BitcoinBehavioralClusters />}
        {activeTab === 'timeline' && <BitcoinAnomalyTimeline />}
        {activeTab === 'investigations' && <BitcoinInvestigations initialLead={activeLeadForCase} onViewInvestigation={handleViewInvestigation} />}
        {activeTab === 'investigation-view' && activeInvestigationId && (
          <BitcoinInvestigationView
            investigationId={activeInvestigationId}
            onBack={() => navigate('/bitcoin/investigations')}
          />
        )}
        {['models', 'sources', 'settings'].includes(activeTab) && (
          <div className="flex flex-col items-center justify-center h-96 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-10 text-center shadow-lg">
            <div className="w-16 h-16 bg-[var(--bg-elevated)] rounded-2xl flex items-center justify-center mb-4 border border-[var(--border-default)]">
              {activeTab === 'models' && <Cpu className="w-8 h-8 text-[var(--network-cyan)]" />}
              {activeTab === 'sources' && <Database className="w-8 h-8 text-[var(--behavior-purple)]" />}
              {activeTab === 'settings' && <Sliders className="w-8 h-8 text-[var(--text-muted)]" />}
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] capitalize mb-2">{activeTab} Module</h2>
            <p className="text-sm text-[var(--text-muted)] max-w-md">
              This module is currently undergoing system upgrades for V.E.C.T.O.R v2.0.0. Please check back later for advanced {activeTab} configuration.
            </p>
          </div>
        )}
      </main>

      {/* Floating Sticky Live Feed Ticker at Bottom */}
      <div className="fixed bottom-3 left-4 right-4 z-40 bg-[var(--bg-elevated)]/95 backdrop-blur-md border border-[var(--border-strong)] rounded-xl px-4 py-2 flex items-center justify-between gap-3 shadow-2xl">
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--success)]"></span>
          </span>
          <span className="text-[11px] font-bold text-[var(--success)] tracking-wide uppercase">
            Live Feed
          </span>
        </div>

        {/* Live Transaction Chips */}
        <div className="flex items-center gap-4 overflow-x-auto text-xs custom-scrollbar py-0.5">
          {transactions.slice(0, 6).map((tx, idx) => {
            const isCrit = tx.risk_level === 'CRITICAL';
            const isHigh = tx.risk_level === 'HIGH';
            const isMed = tx.risk_level === 'MEDIUM';

            return (
              <div 
                key={tx.txid || idx}
                onClick={() => handleSelectTx(tx)}
                className="cursor-pointer flex items-center gap-2 bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-2.5 py-1 rounded-lg transition-all shrink-0"
              >
                <span className="font-mono text-[var(--text-primary)] text-[11px]">{tx.txid.slice(0, 8)}...</span>
                <span className="font-mono font-bold text-[var(--accent-primary)] text-[11px]">₿ {tx.total_output_btc?.toFixed(4)}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                  isCrit ? 'bg-[var(--risk-critical)]/20 text-[var(--risk-critical)] border border-[var(--risk-critical)]/40' :
                  isHigh ? 'bg-[var(--risk-high)]/20 text-[var(--risk-high)] border border-[var(--risk-high)]/40' :
                  isMed ? 'bg-[var(--risk-medium)]/20 text-[var(--risk-medium)] border border-[var(--risk-medium)]/40' :
                  'bg-[var(--success)]/20 text-[var(--success)] border border-[var(--success)]/40'
                }`}>
                  {tx.risk_level || 'LOW'}
                </span>
              </div>
            );
          })}
        </div>

        {/* View All Button */}
        <button 
          onClick={() => handleTabChange('live')}
          className="shrink-0 flex items-center gap-1 text-xs font-bold text-[var(--network-cyan)] hover:text-[var(--network-cyan)]/80 transition-colors"
        >
          <span>View All</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default BitcoinDashboard;
