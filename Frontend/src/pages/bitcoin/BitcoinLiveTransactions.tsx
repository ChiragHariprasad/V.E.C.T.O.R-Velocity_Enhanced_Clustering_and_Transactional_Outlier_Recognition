import React, { useState } from 'react';
import { 
  Radio, 
  Search, 
  ChevronRight, 
  ShieldAlert, 
  CheckCircle, 
  Clock, 
  ArrowRight
} from 'lucide-react';
import { useBitcoin } from '../../context/BitcoinContext';
import { BitcoinTransaction } from '../../types/bitcoin';

interface Props {
  onSelectTx: (tx: BitcoinTransaction) => void;
}

const BitcoinLiveTransactions: React.FC<Props> = ({ onSelectTx }) => {
  const { transactions } = useBitcoin();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRisk, setFilterRisk] = useState<string>('ALL');

  const filteredTxs = transactions.filter(t => {
    const matchesSearch = 
      t.txid.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.entity_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.input_addresses.some(a => a.toLowerCase().includes(searchTerm.toLowerCase())) ||
      t.output_addresses.some(a => a.toLowerCase().includes(searchTerm.toLowerCase()));

    if (filterRisk === 'ALL') return matchesSearch;
    return matchesSearch && t.risk_level === filterRisk;
  });

  const getRiskBadge = (level: string, score: number) => {
    if (level === 'CRITICAL') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/40">
          <ShieldAlert className="w-3 h-3 mr-1 text-red-400" />
          CRITICAL ({score})
        </span>
      );
    } else if (level === 'HIGH') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/40">
          <ShieldAlert className="w-3 h-3 mr-1 text-orange-400" />
          HIGH ({score})
        </span>
      );
    } else if (level === 'MEDIUM') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
          MEDIUM ({score})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
        <CheckCircle className="w-3 h-3 mr-1 text-emerald-400" />
        LOW ({score})
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header & Filter Controls */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-4 border border-[var(--border-subtle)] shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
              Live Bitcoin Transaction Feed
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-500">
                Streaming
              </span>
            </h2>
            <p className="text-xs text-[var(--text-muted)]">Continuous UTXO parsing and real-time behavioral anomaly inference</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search TXID, Entity, or Address..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] focus:border-amber-500/60 rounded-xl pl-9 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
            />
          </div>

          <select
            value={filterRisk}
            onChange={e => setFilterRisk(e.target.value)}
            className="text-xs bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--text-secondary)] rounded-xl px-3 py-1.5 outline-none focus:border-amber-500"
          >
            <option value="ALL">All Risk Levels</option>
            <option value="CRITICAL">Critical Risk</option>
            <option value="HIGH">High Risk</option>
            <option value="MEDIUM">Medium Risk</option>
            <option value="LOW">Low Risk</option>
          </select>
        </div>
      </div>

      {/* Transaction Stream Table */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--border-subtle)]">
            <thead className="bg-[var(--bg-elevated)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Transaction ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Block / Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Entity ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">UTXO Structure</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Volume (BTC)</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Risk Classification</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--bg-surface)]">
              {filteredTxs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-muted)] text-sm">
                    No transactions match the search filters.
                  </td>
                </tr>
              ) : (
                filteredTxs.map(tx => (
                  <tr key={tx.txid} className="hover:bg-[var(--bg-elevated)]/70 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-cyan-500 font-semibold block truncate max-w-[140px]" title={tx.txid}>
                        {tx.txid}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-xs font-medium text-[var(--text-primary)] font-mono">#{tx.block_height}</div>
                      <div className="text-[11px] text-[var(--text-muted)] flex items-center font-mono">
                        <Clock className="w-3 h-3 mr-0.5" /> {tx.time || '12:00:00'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-mono font-medium text-indigo-400 bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 rounded">
                        {tx.entity_id}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-[var(--text-secondary)] font-mono">
                        {tx.input_count} In <ArrowRight className="w-3 h-3 inline text-[var(--text-muted)]" /> {tx.output_count} Out
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-mono font-bold text-amber-500">
                        ₿ {tx.total_output_btc.toFixed(4)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getRiskBadge(tx.risk_level, tx.risk_score)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <button
                        onClick={() => onSelectTx(tx)}
                        className="inline-flex items-center text-xs font-bold text-cyan-500 hover:text-cyan-600 bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-1 rounded-lg hover:bg-cyan-500/20 transition-colors"
                      >
                        Inspect <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BitcoinLiveTransactions;
