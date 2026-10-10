import React from 'react';
import { 
  Layers, 
  Info
} from 'lucide-react';
import { useBitcoin } from '../../context/BitcoinContext';

const BitcoinBehavioralClusters: React.FC = () => {
  const { clusters, entities } = useBitcoin();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[var(--bg-surface)] rounded-xl p-5 border border-[var(--border-subtle)] shadow-sm flex justify-between items-center transition-colors duration-300">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Layers className="w-5 h-5 text-[var(--behavior-purple)]" />
            HDBSCAN Behavioral Communities
          </h2>
          <p className="text-xs text-[var(--text-muted)]">Unsupervised density clustering over UMAP-reduced behavioral feature vectors</p>
        </div>
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[var(--behavior-purple)]/10 text-[var(--behavior-purple)] border border-[var(--behavior-purple)]/20">
          {clusters.length} Distinct Communities
        </span>
      </div>

      {/* Cluster Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {clusters.map(c => {
          const matchedEntities = entities.filter(e => e.cluster_id === c.cluster_id);
          return (
            <div key={c.cluster_id} className="bg-[var(--bg-surface)] rounded-xl p-5 border border-[var(--border-subtle)] shadow-sm space-y-4 hover:border-[var(--behavior-purple)]/40 transition-all duration-300">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-mono font-bold text-[var(--behavior-purple)] uppercase tracking-wider block">
                    Community #{c.cluster_id}
                  </span>
                  <h3 className="text-base font-bold text-[var(--text-primary)] mt-0.5">{c.name}</h3>
                </div>
                <div className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                  c.anomaly_rate_pct > 50 ? 'bg-[var(--risk-critical)]/20 text-[var(--risk-critical)]' : 'bg-[var(--success)]/20 text-[var(--success)]'
                }`}>
                  {c.anomaly_rate_pct}% Outliers
                </div>
              </div>

              <p className="text-xs text-[var(--text-muted)] leading-relaxed bg-[var(--bg-elevated)] p-3 rounded-lg border border-[var(--border-default)]">
                {c.description}
              </p>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border-subtle)] text-center">
                <div>
                  <span className="text-[11px] text-[var(--text-muted)] block">Entities</span>
                  <span className="text-xs font-mono font-bold text-[var(--text-primary)]">{c.entity_count}</span>
                </div>
                <div>
                  <span className="text-[11px] text-[var(--text-muted)] block">Avg Inflow</span>
                  <span className="text-xs font-mono font-bold text-[var(--success)]">₿ {c.avg_volume_btc}</span>
                </div>
                <div>
                  <span className="text-[11px] text-[var(--text-muted)] block">Velocity</span>
                  <span className="text-xs font-mono font-bold text-[var(--accent-primary)]">{c.avg_velocity_1h} tx/h</span>
                </div>
              </div>

              <div className="pt-2">
                <span className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1.5">Sample Clustered Entities:</span>
                <div className="flex flex-wrap gap-1">
                  {matchedEntities.slice(0, 3).map(e => (
                    <span key={e.entity_id} className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-default)]">
                      {e.entity_id}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Scientific Principle Notice */}
      <div className="bg-[var(--network-cyan)]/10 border border-[var(--network-cyan)]/30 rounded-xl p-4 flex items-start gap-3 text-xs text-[var(--text-primary)]">
        <Info className="w-5 h-5 text-[var(--network-cyan)] shrink-0 mt-0.5" />
        <div>
          <strong className="text-[var(--network-cyan)] font-bold">Methodological Design:</strong> Communities are discovered organically via HDBSCAN density clustering without pre-imposing fixed category counts. Anomaly detection (Isolation Forest) is specialized per cluster so what is normal for high-frequency streams is not falsely flagged against low-frequency whale settlements.
        </div>
      </div>
    </div>
  );
};

export default BitcoinBehavioralClusters;
