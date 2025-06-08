import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  color: string;
  isLoading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  change,
  trend,
  color,
  isLoading = false
}) => {
  const colorClasses = {
    primary: 'bg-primary-50 text-primary-500 border-primary-100',
    secondary: 'bg-secondary-50 text-secondary-500 border-secondary-100',
    success: 'bg-success-50 text-success-500 border-success-100',
    warning: 'bg-warning-50 text-warning-500 border-warning-100',
    danger: 'bg-danger-50 text-danger-500 border-danger-100',
  };
  
  const trendColors = {
    up: 'text-success-600',
    down: 'text-danger-600',
    neutral: 'text-gray-600'
  };
  
  return (
    <motion.div
      className="stat-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-grow">
          <h3 className="text-gray-500 text-sm font-medium mb-1">{title}</h3>
          {isLoading ? (
            <div className="h-8 w-24 rounded-md loading-shimmer"></div>
          ) : (
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          )}
        </div>
        <div className={`p-2 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      
      {change && (
        <div className="mt-2 flex items-center">
          {trend === 'up' && <span className="text-success-500">↑</span>}
          {trend === 'down' && <span className="text-danger-500">↓</span>}
          {trend === 'neutral' && <span className="text-gray-500">→</span>}
          <span className={`text-xs font-medium ml-1 ${trendColors[trend || 'neutral']}`}>
            {change}
          </span>
        </div>
      )}
    </motion.div>
  );
};

export default StatCard;