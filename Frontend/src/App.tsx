import React, { useEffect, useState } from 'react';
import { socket } from './socket';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import { TransactionProvider } from './context/TransactionContext';
import LoadingScreen from './components/LoadingScreen';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
    }, 1500);

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
    <TransactionProvider>
      <div className="min-h-screen bg-gray-50">
        <Header isConnected={isConnected} />
        <main className="container mx-auto px-4 py-6">
          <Dashboard />
        </main>
        
        {!isConnected && (
          <div className="fixed bottom-4 right-4 bg-danger-100 text-danger-800 px-4 py-2 rounded-md shadow-md flex items-center">
            <span className="inline-block w-3 h-3 bg-danger-500 rounded-full mr-2"></span>
            Disconnected from server
          </div>
        )}
      </div>
    </TransactionProvider>
  );
}

export default App;