import React from 'react';
import { 
  TrendingUp, 
  Clock, 
  Activity, 
  ShieldAlert, 
  AlertTriangle 
} from 'lucide-react';
import { useBitcoin } from '../../context/BitcoinContext';
import { Line } from 'react-chartjs-2';

const BitcoinAnomalyTimeline: React.FC = () => {
  const { transactions } = useBitcoin();

  const sortedTxs = [...transactions].sort((a, b) => a.timestamp - b.timestamp);

  const timelineData = {
    labels: sortedTxs.slice(-20).map(t => t.time || '12:00'),
    datasets: [
      {
        label: 'Risk Score',
        data: sortedTxs.slice(-20).map(t => t.risk_score),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        yAxisID: 'yRisk',
        tension: 0.3
      },
      {
        label: 'Transferred Volume (BTC)',
        data: sortedTxs.slice(-20).map(t => t.total_output_btc),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        yAxisID: 'yVol',
        tension: 0.3
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    color: '#cbd5e1',
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8' }
      },
      yRisk: {
        type: 'linear' as const,
        position: 'left' as const,
        max: 100,
        min: 0,
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#ef4444' },
        title: { display: true, text: 'Risk Score (0-100)', color: '#ef4444' }
      },
      yVol: {
        type: 'linear' as const,
        position: 'right' as const,
        grid: { drawOnChartArea: false },
        ticks: { color: '#f59e0b' },
        title: { display: true, text: 'BTC Volume', color: '#f59e0b' }
      }
    },
    plugins: {
      legend: { labels: { color: '#f1f5f9' } }
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[var(--bg-surface)] rounded-xl p-5 border border-[var(--border-subtle)] shadow-sm flex justify-between items-center transition-colors duration-300">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[var(--accent-primary)]" />
            Behavioral Anomaly & Temporal Deviation Timeline
          </h2>
          <p className="text-xs text-[var(--text-muted)]">Historical deviation tracking comparing baseline behavioral norms against sudden burst and risk spikes</p>
        </div>
      </div>

      <div className="bg-[var(--bg-surface)] rounded-xl p-6 border border-[var(--border-subtle)] shadow-sm">
        <div className="h-80">
          <Line data={timelineData} options={chartOptions as any} />
        </div>
      </div>
    </div>
  );
};

export default BitcoinAnomalyTimeline;
