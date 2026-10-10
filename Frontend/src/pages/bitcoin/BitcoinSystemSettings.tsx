import React, { useState } from 'react';
import { Sliders, Shield, Cpu, Save, Check, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export const BitcoinSystemSettings: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [criticalThreshold, setCriticalThreshold] = useState(0.85);
  const [highThreshold, setHighThreshold] = useState(0.65);
  const [maxHops, setMaxHops] = useState(3);
  const [dustLimit, setDustLimit] = useState(546);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 flex items-center justify-center shrink-0">
            <Sliders className="w-6 h-6 text-[var(--accent-primary)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">System & Heuristic Configuration</h1>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Fine-tune anomaly thresholds, risk propagation parameters, and investigator interface defaults.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Thresholds */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-[var(--risk-critical)]" />
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Investigation Risk Thresholds</h2>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-semibold text-[var(--text-primary)]">Critical Risk (P1 Alert Trigger)</span>
                <span className="font-mono font-bold text-[var(--risk-critical)]">≥ {criticalThreshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.70"
                max="0.99"
                step="0.01"
                value={criticalThreshold}
                onChange={(e) => setCriticalThreshold(parseFloat(e.target.value))}
                className="w-full accent-[var(--risk-critical)] cursor-pointer"
              />
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                Entities or transactions exceeding this composite score generate immediate P1 priority triage leads.
              </p>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-semibold text-[var(--text-primary)]">High Risk (P2 Lead Trigger)</span>
                <span className="font-mono font-bold text-[var(--risk-high)]">≥ {highThreshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.50"
                max="0.84"
                step="0.01"
                value={highThreshold}
                onChange={(e) => setHighThreshold(parseFloat(e.target.value))}
                className="w-full accent-[var(--risk-high)] cursor-pointer"
              />
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                Enables automatic multi-hop expansion and behavioral cluster proximity tracking.
              </p>
            </div>
          </div>
        </div>

        {/* Engine Parameters */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-[var(--network-cyan)]" />
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Graph & Propagation Limits</h2>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-semibold text-[var(--text-primary)]">Max Risk Propagation Depth</span>
                <span className="font-mono font-bold text-[var(--text-primary)]">{maxHops} Hops</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={maxHops}
                onChange={(e) => setMaxHops(parseInt(e.target.value))}
                className="w-full accent-[var(--accent-primary)] cursor-pointer"
              />
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                Limits recursive forward & backward BFS exploration depth for transaction flows.
              </p>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-semibold text-[var(--text-primary)]">Dust Limit Threshold</span>
                <span className="font-mono font-bold text-[var(--text-primary)]">{dustLimit} Satoshis</span>
              </div>
              <input
                type="number"
                value={dustLimit}
                onChange={(e) => setDustLimit(parseInt(e.target.value) || 0)}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl px-3 py-1.5 text-xs font-mono text-[var(--text-primary)]"
              />
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                Outputs equal to or below this amount are flagged for dust attacks and mixer obfuscation.
              </p>
            </div>
          </div>
        </div>

        {/* Appearance Settings */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-6 shadow-sm space-y-5 lg:col-span-2">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-[var(--accent-primary)]" />
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Interface Appearance</h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-[var(--text-primary)] block">Theme Mode</span>
              <span className="text-[11px] text-[var(--text-muted)]">Current mode: {theme === 'light' ? 'Light Theme' : 'Dark Theme'}</span>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="px-4 py-2 bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-xl text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2 transition-all shadow-sm"
            >
              {theme === 'light' ? <Moon className="w-3.5 h-3.5 text-amber-500" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
              <span>Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={handleSave}
          className="px-5 py-2.5 bg-[var(--accent-primary)] text-[var(--bg-base)] rounded-xl text-xs font-bold transition-all shadow-md hover:opacity-90 flex items-center gap-2"
        >
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          <span>{saved ? 'Configuration Saved' : 'Apply Configuration'}</span>
        </button>
      </div>
    </div>
  );
};

export default BitcoinSystemSettings;
