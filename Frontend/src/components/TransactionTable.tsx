import React, { useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle, Search, ChevronRight, ChevronLeft } from 'lucide-react';
import { Transaction, MERCHANT_CATEGORIES, DEVICE_TYPES } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

interface TransactionTableProps {
  transactions: Transaction[];
  isSearchResults?: boolean;
}

const TransactionTable: React.FC<TransactionTableProps> = ({ 
  transactions,
  isSearchResults = false
}) => {
  const [page, setPage] = useState(1);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const rowsPerPage = 10;
  
  const totalPages = Math.ceil(transactions.length / rowsPerPage);
  const startIndex = (page - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentPageData = transactions.slice(startIndex, endIndex);
  
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  const toggleExpandRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };
  
  const getMerchantCategory = (code: string | number) => {
    if (typeof code === 'number') {
      return MERCHANT_CATEGORIES[code] || 'Unknown';
    }
    return code;
  };
  
  const getDeviceType = (code: string | number) => {
    if (typeof code === 'number') {
      return DEVICE_TYPES[code] || 'Unknown';
    }
    return code;
  };
  
  const getFraudStatus = (transaction: Transaction) => {
    if (transaction.fraud_score && transaction.fraud_score > 0.7) {
      return {
        status: 'Fraud',
        score: transaction.fraud_score,
        icon: <AlertTriangle className="h-4 w-4 text-danger-500" />,
        badgeClass: 'bg-danger-100 text-danger-800'
      };
    } else if (transaction.legit_token) {
      return {
        status: 'Legitimate',
        score: transaction.fraud_score || 0,
        icon: <CheckCircle className="h-4 w-4 text-success-500" />,
        badgeClass: 'bg-success-100 text-success-800'
      };
    } else {
      return {
        status: 'Suspicious',
        score: transaction.fraud_score || 0.5,
        icon: <Search className="h-4 w-4 text-warning-500" />,
        badgeClass: 'bg-warning-100 text-warning-800'
      };
    }
  };
  
  if (transactions.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
        <Search className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-700 mb-1">No transactions found</h3>
        <p className="text-gray-500">
          {isSearchResults 
            ? "Try adjusting your search filters to find more results." 
            : "Transactions will appear here as they come in."}
        </p>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Transaction
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Merchant
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date & Time
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <AnimatePresence initial={false}>
              {currentPageData.map((transaction, index) => {
                const isNew = index === 0 && !isSearchResults;
                const fraudStatus = getFraudStatus(transaction);
                
                return (
                  <React.Fragment key={transaction._id}>
                    <motion.tr 
                      initial={isNew ? { opacity: 0, backgroundColor: 'rgba(56, 189, 248, 0.2)' } : { opacity: 1 }}
                      animate={{ opacity: 1, backgroundColor: 'transparent' }}
                      transition={{ duration: 2 }}
                      className={`hover:bg-gray-50 cursor-pointer ${isNew ? 'transaction-new' : ''}`}
                      onClick={() => toggleExpandRow(transaction._id)}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {transaction.fraud_token || transaction.legit_token || 'Unknown'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {transaction.User_ID}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                        {formatAmount(transaction.Amount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {getMerchantCategory(transaction.Merchant_Category)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {transaction.Date} {transaction.Time}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${fraudStatus.badgeClass}`}>
                          {fraudStatus.icon}
                          <span className="ml-1">{fraudStatus.status}</span>
                        </div>
                      </td>
                    </motion.tr>
                    
                    {expandedRow === transaction._id && (
                      <motion.tr
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <td colSpan={6} className="px-4 py-3 bg-gray-50">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3">
                            <div>
                              <h4 className="text-xs font-medium text-gray-500 mb-1">Transaction Details</h4>
                              <p className="text-sm"><span className="font-medium">Device:</span> {getDeviceType(transaction.Device_Type)}</p>
                              <p className="text-sm"><span className="font-medium">Session Time:</span> {transaction.Session_Time}s</p>
                              <p className="text-sm"><span className="font-medium">Active Loans:</span> {transaction.Active_Loans}</p>
                            </div>
                            
                            <div>
                              <h4 className="text-xs font-medium text-gray-500 mb-1">Risk Metrics</h4>
                              <p className="text-sm"><span className="font-medium">Fraud Score:</span> {transaction.fraud_score ? (transaction.fraud_score * 100).toFixed(2) + '%' : 'N/A'}</p>
                              <p className="text-sm"><span className="font-medium">Avg Amount:</span> {transaction.Avg_Amount ? formatAmount(transaction.Avg_Amount) : 'N/A'}</p>
                              <p className="text-sm"><span className="font-medium">Large Transaction:</span> {transaction.Large_Transaction_Flag ? 'Yes' : 'No'}</p>
                            </div>
                            
                            <div>
                              <h4 className="text-xs font-medium text-gray-500 mb-1">Velocity</h4>
                              <p className="text-sm"><span className="font-medium">Transactions Per Day:</span> {transaction.Transactions_Per_Day || 'N/A'}</p>
                              <p className="text-sm"><span className="font-medium">Velocity:</span> {transaction.Velocity || 'N/A'}</p>
                              <p className="text-sm"><span className="font-medium">Large TX Frequency:</span> {transaction.Large_Transaction_Frequency || 'N/A'} days</p>
                            </div>
                          </div>
                        </td>
                      </motion.tr>
                    )}
                  </React.Fragment>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 sm:px-6 flex items-center justify-between">
          <div className="flex-1 flex justify-between sm:hidden">
            <button 
              onClick={() => setPage(Math.max(1, page - 1))} 
              disabled={page === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button 
              onClick={() => setPage(Math.min(totalPages, page + 1))} 
              disabled={page === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, transactions.length)}</span> of{' '}
                <span className="font-medium">{transactions.length}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  
                  return (
                    <button
                      key={i}
                      onClick={() => setPage(pageNum)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        page === pageNum
                          ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionTable;