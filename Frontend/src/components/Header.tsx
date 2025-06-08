import React from 'react';
import { AlertTriangle, BarChart2, Activity } from 'lucide-react';
import { useTransactions } from '../context/TransactionContext';

interface HeaderProps {
  isConnected: boolean;
}

const Header: React.FC<HeaderProps> = ({ isConnected }) => {
  const { stats } = useTransactions();

  return (
    <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0">
          <div className="flex items-center">
            <div className="flex items-center mr-2">
              <Activity className="h-6 w-6 sm:h-7 sm:w-7 text-primary-600 mr-2" />
              <h1 className="text-xl sm:text-2xl font-bold text-primary-800">V.E.C.T.O.R</h1>
            </div>
            <span className="hidden sm:inline text-sm font-medium text-gray-500">Velocity-Enhanced Clustering for 
Transactional Outlier Recognition</span>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
            <div className="flex items-center">
              <BarChart2 className="h-4 w-4 sm:h-5 sm:w-5 text-secondary-500 mr-1" />
              <span className="text-xs sm:text-sm font-medium">
                <span className="text-gray-600">Today: </span>
                <span className="text-gray-900">{stats.totalTransactions} Transactions</span>
              </span>
            </div>
            
            <div className="flex items-center">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-danger-500 mr-1" />
              <span className="text-xs sm:text-sm font-medium">
                <span className="text-gray-600">Fraud Rate: </span>
                <span className={`${stats.fraudPercentage > 5 ? 'text-danger-600' : 'text-gray-900'}`}>
                  {stats.fraudPercentage}%
                </span>
              </span>
            </div>
            
            <div 
              className={`flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${
                isConnected ? 'bg-success-100 text-success-800' : 'bg-danger-100 text-danger-800'
              }`}
            >
              <span className={`inline-block w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full mr-1 sm:mr-1.5 ${
                isConnected ? 'bg-success-500 animate-pulse' : 'bg-danger-500'
              }`}></span>
              {isConnected ? 'Live' : 'Disconnected'}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;