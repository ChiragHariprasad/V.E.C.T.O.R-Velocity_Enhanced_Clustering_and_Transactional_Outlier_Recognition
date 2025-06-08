import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { TransactionFilters, MERCHANT_CATEGORIES, DEVICE_TYPES } from '../types';
import { useTransactions } from '../context/TransactionContext';
import { motion } from 'framer-motion';

const SearchFilters: React.FC = () => {
  const { searchTransactions, clearFilters } = useTransactions();
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<TransactionFilters>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (name === 'fraudOnly' || name === 'legitOnly') {
      // Handle checkboxes
      const checkboxInput = e.target as HTMLInputElement;
      setFilters({ ...filters, [name]: checkboxInput.checked });
    } else if (type === 'number' && value) {
      // Handle number inputs
      setFilters({ ...filters, [name]: parseFloat(value) });
    } else if (value) {
      // Handle other inputs
      setFilters({ ...filters, [name]: value });
    } else {
      // If value is empty, remove the field from filters
      const newFilters = { ...filters };
      delete newFilters[name as keyof TransactionFilters];
      setFilters(newFilters);
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchTransactions(filters);
  };
  
  const handleClear = () => {
    setFilters({});
    clearFilters();
  };
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Search className="h-5 w-5 mr-2 text-gray-500" />
          Search Transactions
        </h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm font-medium text-primary-600 hover:text-primary-500"
        >
          {isExpanded ? 'Hide Filters' : 'Show Filters'}
        </button>
      </div>
      
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: isExpanded ? 'auto' : 0, opacity: isExpanded ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <form onSubmit={handleSubmit} className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
              <input
                type="text"
                name="userId"
                value={filters.userId || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring focus:ring-primary-200 focus:border-primary-500"
                placeholder="Enter user ID"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount Range (₹)</label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  name="minAmount"
                  value={filters.minAmount || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring focus:ring-primary-200 focus:border-primary-500"
                  placeholder="Min"
                />
                <span>-</span>
                <input
                  type="number"
                  name="maxAmount"
                  value={filters.maxAmount || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring focus:ring-primary-200 focus:border-primary-500"
                  placeholder="Max"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Merchant Category</label>
              <select
                name="merchantCategory"
                value={filters.merchantCategory || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring focus:ring-primary-200 focus:border-primary-500"
              >
                <option value="">All Categories</option>
                {Object.entries(MERCHANT_CATEGORIES).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Device Type</label>
              <select
                name="deviceType"
                value={filters.deviceType || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring focus:ring-primary-200 focus:border-primary-500"
              >
                <option value="">All Devices</option>
                {Object.entries(DEVICE_TYPES).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
              <div className="flex items-center space-x-2">
                <input
                  type="date"
                  name="startDate"
                  value={filters.startDate || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring focus:ring-primary-200 focus:border-primary-500"
                />
                <span>-</span>
                <input
                  type="date"
                  name="endDate"
                  value={filters.endDate || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring focus:ring-primary-200 focus:border-primary-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
              <div className="flex items-center space-x-4 mt-2">
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    name="fraudOnly"
                    checked={filters.fraudOnly || false}
                    onChange={handleChange}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Fraud Only</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    name="legitOnly"
                    checked={filters.legitOnly || false}
                    onChange={handleChange}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Legitimate Only</span>
                </label>
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <X className="w-4 h-4 inline mr-1" />
              Clear
            </button>
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Search className="w-4 h-4 inline mr-1" />
              Search
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default SearchFilters;