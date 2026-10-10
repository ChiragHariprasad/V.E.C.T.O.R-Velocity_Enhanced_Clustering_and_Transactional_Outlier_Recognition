import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { socket } from '../socket';
import { 
  Transaction, 
  TransactionStats, 
  ChartData, 
  TransactionFilters, 
  MERCHANT_CATEGORIES, 
  DEVICE_TYPES 
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL !== undefined
  ? import.meta.env.VITE_API_BASE_URL
  : (typeof window !== 'undefined' && window.location.port === '5173' ? 'http://localhost:3001' : '');

interface TransactionContextType {
  transactions: Transaction[];
  allTransactions: Transaction[];
  stats: TransactionStats;
  merchantChart: ChartData;
  deviceChart: ChartData;
  timeSeriesChart: ChartData;
  amountDistributionChart: ChartData;
  isLoading: boolean;
  filters: TransactionFilters;
  setFilters: React.Dispatch<React.SetStateAction<TransactionFilters>>;
  searchTransactions: (filters: TransactionFilters) => void;
  clearFilters: () => void;
  showAllData: boolean;
  setShowAllData: React.Dispatch<React.SetStateAction<boolean>>;
}

const defaultStats: TransactionStats = {
  totalTransactions: 0,
  fraudTransactions: 0,
  legitTransactions: 0,
  fraudPercentage: 0,
  avgAmount: 0,
  lastUpdated: new Date()
};

const defaultChartData: ChartData = {
  labels: [],
  datasets: [{
    label: '',
    data: [],
    backgroundColor: []
  }]
};

const TransactionContext = createContext<TransactionContextType>({
  transactions: [],
  allTransactions: [],
  stats: defaultStats,
  merchantChart: defaultChartData,
  deviceChart: defaultChartData,
  timeSeriesChart: defaultChartData,
  amountDistributionChart: defaultChartData,
  isLoading: true,
  filters: {},
  setFilters: () => {},
  searchTransactions: () => {},
  clearFilters: () => {},
  showAllData: false,
  setShowAllData: () => {}
});

export const useTransactions = () => useContext(TransactionContext);

export const TransactionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<TransactionStats>(defaultStats);
  const [merchantChart, setMerchantChart] = useState<ChartData>(defaultChartData);
  const [deviceChart, setDeviceChart] = useState<ChartData>(defaultChartData);
  const [timeSeriesChart, setTimeSeriesChart] = useState<ChartData>(defaultChartData);
  const [amountDistributionChart, setAmountDistributionChart] = useState<ChartData>(defaultChartData);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [showAllData, setShowAllData] = useState(false);
  
  // Initialize data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/transactions`);
        const data = response.data;
        
        // Keep only latest 20 transactions for the main view
        const latestTransactions = [...data].sort((a, b) => {
          const dateA = new Date(`${a.Date} ${a.Time}`);
          const dateB = new Date(`${b.Date} ${b.Time}`);
          return dateB.getTime() - dateA.getTime();
        }).slice(0, 20);
        
        setTransactions(latestTransactions);
        setAllTransactions(data);
        updateStats(data);
        updateCharts(data);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching initial data:', error);
        setIsLoading(false);
      }
    };
    
    fetchInitialData();
  }, []);

  // Listen for live updates
  useEffect(() => {
    const handleNewTransaction = (transaction: Transaction) => {
      setAllTransactions(prev => {
        const newData = [transaction, ...prev];
        updateStats(newData);
        updateCharts(newData);
        return newData;
      });
      
      setTransactions(prev => {
        const updated = [transaction, ...prev].slice(0, 20);
        return updated;
      });
    };
    
    socket.on('newTransaction', handleNewTransaction);
    
    return () => {
      socket.off('newTransaction', handleNewTransaction);
    };
  }, []);

  // Update statistics
  const updateStats = (data: Transaction[]) => {
    const fraudCount = data.filter(tx => tx.fraud_score && tx.fraud_score > 0.7).length;
    const legitCount = data.filter(tx => tx.legit_token).length;
    const totalCount = data.length;
    const fraudPercentage = totalCount > 0 ? (fraudCount / totalCount) * 100 : 0;
    const totalAmount = data.reduce((sum, tx) => sum + tx.Amount, 0);
    const avgAmount = totalCount > 0 ? totalAmount / totalCount : 0;
    
    setStats({
      totalTransactions: totalCount,
      fraudTransactions: fraudCount,
      legitTransactions: legitCount,
      fraudPercentage: parseFloat(fraudPercentage.toFixed(2)),
      avgAmount: parseFloat(avgAmount.toFixed(2)),
      lastUpdated: new Date()
    });
  };

  // Update chart data
  const updateCharts = (data: Transaction[]) => {
    // Merchant Category Chart
    const merchantCounts: Record<string, number> = {};
    for (const tx of data) {
      const category = typeof tx.Merchant_Category === 'number' 
        ? MERCHANT_CATEGORIES[tx.Merchant_Category] 
        : tx.Merchant_Category as string;
      
      merchantCounts[category] = (merchantCounts[category] || 0) + 1;
    }
    
    setMerchantChart({
      labels: Object.keys(merchantCounts),
      datasets: [{
        label: 'Transactions by Merchant Category',
        data: Object.values(merchantCounts),
        backgroundColor: [
          '#38bdf8', '#818cf8', '#a78bfa', '#f472b6', '#fb7185',
          '#4ade80', '#22d3ee', '#60a5fa', '#34d399', '#a3e635',
          '#facc15', '#fb923c', '#f87171', '#c084fc', '#e879f9',
          '#fca5a5', '#67e8f9'
        ]
      }]
    });
    
    // Device Type Chart
    const deviceCounts: Record<string, number> = {};
    for (const tx of data) {
      const deviceType = typeof tx.Device_Type === 'number' 
        ? DEVICE_TYPES[tx.Device_Type] 
        : tx.Device_Type as string;
      
      deviceCounts[deviceType] = (deviceCounts[deviceType] || 0) + 1;
    }
    
    setDeviceChart({
      labels: Object.keys(deviceCounts),
      datasets: [{
        label: 'Transactions by Device Type',
        data: Object.values(deviceCounts),
        backgroundColor: ['#38bdf8', '#818cf8', '#a78bfa']
      }]
    });
    
    // Time Series Chart - Fraud vs Legit over time
    const timeSeriesData: Record<string, { fraud: number; legit: number }> = {};
    const now = new Date();
    
    // Initialize with last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      timeSeriesData[dateStr] = { fraud: 0, legit: 0 };
    }
    
    // Fill with actual data
    for (const tx of data) {
      if (tx.Date) {
        if (!timeSeriesData[tx.Date]) {
          timeSeriesData[tx.Date] = { fraud: 0, legit: 0 };
        }
        
        if (tx.fraud_score && tx.fraud_score > 0.7) {
          timeSeriesData[tx.Date].fraud++;
        } else if (tx.legit_token) {
          timeSeriesData[tx.Date].legit++;
        }
      }
    }
    
    setTimeSeriesChart({
      labels: Object.keys(timeSeriesData),
      datasets: [
        {
          label: 'Fraud Transactions',
          data: Object.values(timeSeriesData).map(d => d.fraud),
          backgroundColor: 'rgba(239, 68, 68, 0.5)',
          borderColor: '#ef4444',
          borderWidth: 2
        },
        {
          label: 'Legitimate Transactions',
          data: Object.values(timeSeriesData).map(d => d.legit),
          backgroundColor: 'rgba(34, 197, 94, 0.5)',
          borderColor: '#22c55e',
          borderWidth: 2
        }
      ]
    });
    
    // Amount Distribution Chart
    const amountRanges = [
      { range: '₹0-1K', min: 0, max: 1000 },
      { range: '₹1K-5K', min: 1000, max: 5000 },
      { range: '₹5K-10K', min: 5000, max: 10000 },
      { range: '₹10K-50K', min: 10000, max: 50000 },
      { range: '₹50K+', min: 50000, max: Infinity }
    ];
    
    const amountCounts = amountRanges.map(range => {
      return {
        range: range.range,
        count: data.filter(tx => tx.Amount >= range.min && tx.Amount < range.max).length
      };
    });
    
    setAmountDistributionChart({
      labels: amountCounts.map(item => item.range),
      datasets: [{
        label: 'Transaction Amount Distribution',
        data: amountCounts.map(item => item.count),
        backgroundColor: [
          'rgba(56, 189, 248, 0.7)',
          'rgba(129, 140, 248, 0.7)',
          'rgba(167, 139, 250, 0.7)',
          'rgba(244, 114, 182, 0.7)',
          'rgba(251, 113, 133, 0.7)'
        ]
      }]
    });
  };

  // Search transactions with filters
  const searchTransactions = (searchFilters: TransactionFilters) => {
    setFilters(searchFilters);
    setShowAllData(true);
    
    // Filter the transactions based on search criteria
    const filteredTransactions = allTransactions.filter(tx => {
      // User ID filter (case-insensitive substring)
      if (searchFilters.userId && searchFilters.userId.trim() !== '') {
        const queryUser = searchFilters.userId.trim().toLowerCase();
        const txUser = (tx.User_ID || '').toLowerCase();
        if (!txUser.includes(queryUser)) {
          return false;
        }
      }
      
      // Amount range filter
      if (searchFilters.minAmount !== undefined && !isNaN(searchFilters.minAmount)) {
        if (Number(tx.Amount) < Number(searchFilters.minAmount)) {
          return false;
        }
      }
      if (searchFilters.maxAmount !== undefined && !isNaN(searchFilters.maxAmount)) {
        if (Number(tx.Amount) > Number(searchFilters.maxAmount)) {
          return false;
        }
      }
      
      // Merchant category filter
      if (
        searchFilters.merchantCategory !== undefined && 
        searchFilters.merchantCategory !== null && 
        String(searchFilters.merchantCategory) !== ''
      ) {
        const targetCategoryCode = Number(searchFilters.merchantCategory);
        let txCatCode: number | undefined;
        if (typeof tx.Merchant_Category === 'number') {
          txCatCode = tx.Merchant_Category;
        } else if (typeof tx.Merchant_Category === 'string') {
          const foundKey = Object.keys(MERCHANT_CATEGORIES).find(
            key => MERCHANT_CATEGORIES[Number(key)]?.toLowerCase() === tx.Merchant_Category?.toString().toLowerCase()
          );
          if (foundKey !== undefined) {
            txCatCode = Number(foundKey);
          }
        }
        if (tx.Merchant_Type_Code !== undefined) {
          txCatCode = Number(tx.Merchant_Type_Code);
        }
        if (txCatCode !== undefined && txCatCode !== targetCategoryCode) {
          return false;
        }
      }
      
      // Device type filter
      if (
        searchFilters.deviceType !== undefined && 
        searchFilters.deviceType !== null && 
        String(searchFilters.deviceType) !== ''
      ) {
        const targetDevCode = Number(searchFilters.deviceType);
        let txDevCode: number | undefined;
        if (typeof tx.Device_Type === 'number') {
          txDevCode = tx.Device_Type;
        } else if (typeof tx.Device_Type === 'string') {
          const foundKey = Object.keys(DEVICE_TYPES).find(
            key => DEVICE_TYPES[Number(key)]?.toLowerCase() === tx.Device_Type?.toString().toLowerCase()
          );
          if (foundKey !== undefined) {
            txDevCode = Number(foundKey);
          }
        }
        if (tx.Device_Type_Code !== undefined) {
          txDevCode = Number(tx.Device_Type_Code);
        }
        if (txDevCode !== undefined && txDevCode !== targetDevCode) {
          return false;
        }
      }
      
      // Date range filter
      const txDateStr = tx.Date ? tx.Date.split(' ')[0] : '';
      if (searchFilters.startDate && txDateStr) {
        if (txDateStr < searchFilters.startDate) {
          return false;
        }
      }
      if (searchFilters.endDate && txDateStr) {
        if (txDateStr > searchFilters.endDate) {
          return false;
        }
      }
      
      // Fraud or legit filter
      const isFraud = Boolean((tx.fraud_score !== undefined && tx.fraud_score > 0.5) || tx.fraud_token !== undefined);
      const isLegit = Boolean(tx.legit_token || (tx.fraud_score !== undefined && tx.fraud_score <= 0.5));
      
      if (searchFilters.fraudOnly && !isFraud) {
        return false;
      }
      if (searchFilters.legitOnly && !isLegit) {
        return false;
      }
      
      return true;
    });
    
    // Show filtered results
    setTransactions(filteredTransactions);
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({});
    setShowAllData(false);
    
    // Reset to show only the latest 20 transactions
    setTransactions(allTransactions.slice(0, 20));
  };

  return (
    <TransactionContext.Provider 
      value={{
        transactions,
        allTransactions,
        stats,
        merchantChart,
        deviceChart,
        timeSeriesChart,
        amountDistributionChart,
        isLoading,
        filters,
        setFilters,
        searchTransactions,
        clearFilters,
        showAllData,
        setShowAllData
      }}
    >
      {children}
    </TransactionContext.Provider>
  );
};