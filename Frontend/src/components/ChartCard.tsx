import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  ChartOptions
} from 'chart.js';
import { ChartData } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface ChartCardProps {
  title: string;
  description?: string;
  type: 'line' | 'bar' | 'pie' | 'doughnut';
  data: ChartData;
  icon: LucideIcon;
  color?: string;
  height?: number;
  options?: ChartOptions<any>;
}

const ChartCard: React.FC<ChartCardProps> = ({
  title,
  description,
  type,
  data,
  icon: Icon,
  color = 'primary',
  height = 300,
  options = {}
}) => {
  const colorClasses = {
    primary: 'bg-primary-50 text-primary-500 border-primary-100',
    secondary: 'bg-secondary-50 text-secondary-500 border-secondary-100',
    success: 'bg-success-50 text-success-500 border-success-100',
    warning: 'bg-warning-50 text-warning-500 border-warning-100',
    danger: 'bg-danger-50 text-danger-500 border-danger-100',
  };
  
  const defaultOptions: ChartOptions<any> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          padding: 20,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        titleColor: '#1f2937',
        bodyColor: '#4b5563',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        padding: 10,
        boxPadding: 5,
        usePointStyle: true,
      },
    },
    elements: {
      line: {
        tension: 0.3,
      },
      point: {
        radius: 4,
        hitRadius: 10,
        hoverRadius: 6,
      },
    },
    scales: type === 'line' || type === 'bar' 
      ? {
          x: {
            grid: {
              display: false,
            },
          },
          y: {
            beginAtZero: true,
            grid: {
              borderDash: [4, 4],
            },
          },
        } 
      : undefined,
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  
  return (
    <motion.div 
      className="dashboard-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {description && <p className="text-sm text-gray-500">{description}</p>}
          </div>
          <div className={`p-2 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </div>
      
      <div style={{ height: `${height}px` }} className="p-4">
        {type === 'line' && <Line data={data} options={mergedOptions} />}
        {type === 'bar' && <Bar data={data} options={mergedOptions} />}
        {type === 'pie' && <Pie data={data} options={mergedOptions} />}
        {type === 'doughnut' && <Doughnut data={data} options={mergedOptions} />}
      </div>
    </motion.div>
  );
};

export default ChartCard;