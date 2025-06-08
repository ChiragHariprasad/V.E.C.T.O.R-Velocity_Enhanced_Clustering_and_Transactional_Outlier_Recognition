import React, { useState } from 'react';
import { format } from 'date-fns';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  DollarSign, 
  ShoppingCart, 
  Smartphone,
  TrendingUp, 
  Clock
} from 'lucide-react';
import { useTransactions } from '../context/TransactionContext';
import StatCard from '../components/StatCard';
import ChartCard from '../components/ChartCard';
import TransactionTable from '../components/TransactionTable';
import SearchFilters from '../components/SearchFilters';

const Dashboard: React.FC = () => {
  const { 
    transactions, 
    stats, 
    merchantChart, 
    deviceChart, 
    timeSeriesChart,
    amountDistributionChart,
    showAllData
  } = useTransactions();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Transaction Dashboard</h1>
        <p className="text-gray-600">
          Real-time transaction monitoring and fraud detection
          <span className="ml-2 text-sm text-gray-500">
            Last updated: {stats.lastUpdated ? format(new Date(stats.lastUpdated), 'MMM d, yyyy h:mm:ss a') : 'Never'}
          </span>
        </p>
      </div>
      
      <SearchFilters />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard
          title="Total Transactions"
          value={stats.totalTransactions.toLocaleString('en-IN')}
          icon={Activity}
          color="primary"
        />
        
        <StatCard
          title="Legitimate Transactions"
          value={stats.legitTransactions.toLocaleString('en-IN')}
          icon={CheckCircle}
          color="success"
        />
        
        <StatCard
          title="Fraud Transactions"
          value={stats.fraudTransactions.toLocaleString('en-IN')}
          icon={AlertTriangle}
          color="danger"
          trend={stats.fraudPercentage > 5 ? "up" : "down"}
          change={`${stats.fraudPercentage}% of total`}
        />
        
        <StatCard
          title="Average Transaction"
          value={formatCurrency(stats.avgAmount)}
          icon={DollarSign}
          color="secondary"
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ChartCard
          title="Fraud vs Legitimate Trends"
          description="Daily transaction count by classification"
          type="line"
          data={timeSeriesChart}
          icon={TrendingUp}
          color="primary"
        />
        
        <ChartCard
          title="Transaction Amount Distribution"
          description="Number of transactions by amount range"
          type="bar"
          data={amountDistributionChart}
          icon={DollarSign}
          color="secondary"
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ChartCard
          title="Merchant Category Distribution"
          description="Transactions by merchant category"
          type="doughnut"
          data={merchantChart}
          icon={ShoppingCart}
          color="success"
          height={250}
        />
        
        <ChartCard
          title="Device Type Distribution"
          description="Transactions by device type"
          type="pie"
          data={deviceChart}
          icon={Smartphone}
          color="warning"
          height={250}
        />
      </div>
      
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <Clock className="h-5 w-5 mr-2 text-primary-500" />
            {showAllData ? 'Transaction Results' : 'Latest Transactions'}
          </h2>
          {!showAllData && (
            <div className="flex items-center">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                <span className="w-2 h-2 mr-1.5 bg-primary-500 rounded-full animate-live-pulse"></span>
                Live Updates
              </span>
            </div>
          )}
        </div>
        
        <TransactionTable 
          transactions={transactions} 
          isSearchResults={showAllData} 
        />
      </div>
    </div>
  );
};

export default Dashboard;