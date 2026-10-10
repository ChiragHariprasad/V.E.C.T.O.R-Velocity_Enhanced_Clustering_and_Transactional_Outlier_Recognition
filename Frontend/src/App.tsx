import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { socket } from './socket';
import Header from './components/Header';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const BitcoinDashboard = lazy(() => import('./pages/bitcoin/BitcoinDashboard'));
const BitcoinTransactionExplorer = lazy(() => import('./pages/bitcoin/BitcoinTransactionExplorer'));
const BitcoinInvestigationView = lazy(() => import('./pages/bitcoin/BitcoinInvestigationView'));
const WalletIntelligence = lazy(() => import('./pages/bitcoin/WalletIntelligence'));
import { TransactionProvider } from './context/TransactionContext';
import { BitcoinProvider } from './context/BitcoinContext';
import { ThemeProvider } from './context/ThemeContext';
import LoadingScreen from './components/LoadingScreen';
import { useParams, useNavigate } from 'react-router-dom';

const InvestigationRoute = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  if (!id) return null;
  return <BitcoinInvestigationView investigationId={id} onBack={() => navigate('/bitcoin/investigations')} />;
};

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeDomain, setActiveDomain] = useState<'financial' | 'bitcoin'>('bitcoin');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Simulate initial data loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      clearTimeout(timer);
    };
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <ThemeProvider>
      <TransactionProvider>
        <BitcoinProvider>
          <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] font-sans selection:bg-[var(--accent-primary)] selection:text-white transition-colors duration-300">
            <Header
            isConnected={isConnected} 
            activeDomain={activeDomain}
            onDomainChange={setActiveDomain}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
          <main className="px-4 sm:px-6 py-5 max-w-[1720px] mx-auto">
            <Suspense fallback={<LoadingScreen />}>
            {activeDomain === 'bitcoin' ? (
              <Routes>
                <Route path="/" element={<Navigate to="/bitcoin" replace />} />
                <Route path="/live" element={<Navigate to="/bitcoin/live" replace />} />
                <Route path="/explorer" element={<Navigate to="/bitcoin/explorer" replace />} />
                <Route path="/entities" element={<Navigate to="/bitcoin/entities" replace />} />
                <Route path="/risk" element={<Navigate to="/bitcoin/risk" replace />} />
                <Route path="/graph" element={<Navigate to="/bitcoin/graph" replace />} />
                <Route path="/clusters" element={<Navigate to="/bitcoin/clusters" replace />} />
                <Route path="/timeline" element={<Navigate to="/bitcoin/timeline" replace />} />
                <Route path="/investigations" element={<Navigate to="/bitcoin/investigations" replace />} />
                <Route path="/bitcoin" element={<BitcoinDashboard />} />
                <Route path="/bitcoin/live" element={<BitcoinDashboard initialTab="live" />} />
                <Route path="/bitcoin/explorer" element={<BitcoinDashboard initialTab="explorer" />} />
                <Route path="/bitcoin/entities" element={<BitcoinDashboard initialTab="entities" />} />
                <Route path="/bitcoin/risk" element={<BitcoinDashboard initialTab="risk" />} />
                <Route path="/bitcoin/graph" element={<BitcoinDashboard initialTab="graph" />} />
                <Route path="/bitcoin/clusters" element={<BitcoinDashboard initialTab="clusters" />} />
                <Route path="/bitcoin/timeline" element={<BitcoinDashboard initialTab="timeline" />} />
                <Route path="/bitcoin/investigations" element={<BitcoinDashboard initialTab="investigations" />} />
                <Route path="/bitcoin/models" element={<BitcoinDashboard initialTab="models" />} />
                <Route path="/bitcoin/sources" element={<BitcoinDashboard initialTab="sources" />} />
                <Route path="/bitcoin/settings" element={<BitcoinDashboard initialTab="settings" />} />
                <Route path="/bitcoin/investigations/:id" element={<InvestigationRoute />} />
                <Route path="/bitcoin/wallet/:id" element={<WalletIntelligence />} />
                <Route path="/bitcoin/transactions/:txid" element={<BitcoinTransactionExplorer />} />
                <Route path="*" element={<Navigate to="/bitcoin" replace />} />
              </Routes>
            ) : (
              <Dashboard />
            )}
            </Suspense>
          </main>
          
          {!isConnected && (
            <div className="fixed bottom-4 right-4 bg-red-950/90 border border-red-500/50 text-red-300 px-4 py-2 rounded-xl shadow-2xl flex items-center z-50 text-xs font-semibold backdrop-blur-md">
              <span className="inline-block w-2.5 h-2.5 bg-red-500 rounded-full mr-2 animate-pulse"></span>
              Disconnected from server
            </div>
          )}
        </div>
      </BitcoinProvider>
    </TransactionProvider>
    </ThemeProvider>
  );
}

export default App;
