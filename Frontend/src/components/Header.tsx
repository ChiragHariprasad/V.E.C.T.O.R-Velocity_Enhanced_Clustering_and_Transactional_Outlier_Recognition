import React from 'react';
import { 
  Activity, 
  Coins, 
  CreditCard, 
  Search, 
  CheckCircle2,
  TrendingUp
} from 'lucide-react';
import { useTransactions } from '../context/TransactionContext';
import { useBitcoin } from '../context/BitcoinContext';
import ThemeToggle from './ThemeToggle';
import SearchOverlay from './SearchOverlay';

interface HeaderProps {
  isConnected: boolean;
  activeDomain: 'financial' | 'bitcoin';
  onDomainChange: (domain: 'financial' | 'bitcoin') => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

const Header: React.FC<HeaderProps> = ({ 
  isConnected, 
  activeDomain, 
  onDomainChange,
  searchQuery = '',
  onSearchChange
}) => {
  const { stats } = useTransactions();
  const { status: btcStatus } = useBitcoin();
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);

  // Keyboard shortcut (cmd+k or ctrl+k)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="bg-[var(--bg-surface)]/95 backdrop-blur-md border-b border-[var(--border-subtle)] sticky top-0 z-40 px-5 py-2.5 transition-colors duration-300">
      <div className="flex items-center justify-between gap-4">
        {/* Left: V.E.C.T.O.R Logo & SIH Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            {/* Logo Icon with golden pulse */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 via-[var(--bg-elevated)] to-[var(--bg-surface)] border border-amber-500/40 flex items-center justify-center text-amber-500 shadow-md shadow-amber-500/10">
              <Activity className="h-5 w-5 text-amber-500 stroke-[2.5]" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-wider text-[var(--text-primary)]">V . E . C . T . O . R</h1>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 border border-amber-500/40 text-amber-500 px-2 py-0.5 rounded-md">
                  SIH26146
                </span>
              </div>
              <p className="hidden md:block text-[10px] text-[var(--text-muted)] font-medium tracking-tight">
                Velocity-Enhanced Clustering for Transactional Outlier Recognition
              </p>
            </div>
          </div>

          {/* Domain Switcher Pills */}
          <div className="flex items-center bg-[var(--bg-elevated)] p-1 rounded-xl border border-[var(--border-subtle)] ml-4">
            <button
              onClick={() => onDomainChange('bitcoin')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeDomain === 'bitcoin'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/25'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              Bitcoin Intelligence
            </button>
            <button
              onClick={() => onDomainChange('financial')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeDomain === 'financial'
                  ? 'bg-gradient-to-r from-primary-600 to-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              Financial Monitoring
            </button>
          </div>
        </div>

        {/* Right Controls: Search, Notifications, Analyst Profile */}
        <div className="flex items-center gap-3.5">
          {/* Search Bar */}
          <div className="relative hidden lg:block w-72">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <button
              onClick={() => setIsSearchOpen(true)}
              className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40 rounded-xl pl-9 pr-3 py-1.5 text-xs text-left text-[var(--text-muted)] outline-none transition-all flex items-center justify-between group"
            >
              <span>Search intelligence...</span>
              <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100">
                <span className="px-1 py-0.5 rounded border border-[var(--border-subtle)] text-[9px] font-mono">⌘</span>
                <span className="px-1 py-0.5 rounded border border-[var(--border-subtle)] text-[9px] font-mono">K</span>
              </div>
            </button>
          </div>

          <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

          <ThemeToggle />


          {/* Analyst Profile Avatar */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-[var(--border-subtle)]">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-primary-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
              VN
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold text-[var(--text-primary)] leading-tight">Analyst Vinith</div>
              <div className="text-[10px] text-emerald-500 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Online
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;