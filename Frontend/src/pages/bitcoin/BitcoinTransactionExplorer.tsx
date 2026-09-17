import React from 'react';
import { 
  ArrowRight, 
  ShieldAlert, 
  CheckCircle, 
  Coins, 
  Layers, 
  Clock, 
  Cpu, 
  FileText, 
  ExternalLink,
  GitCommit,
  Tag
} from 'lucide-react';
import { useBitcoin } from '../../context/BitcoinContext';
import { BitcoinTransaction } from '../../types/bitcoin';

interface Props {
  transaction?: BitcoinTransaction | null;
  onOpenGraph?: (txid: string) => void;
}

const BitcoinTransactionExplorer: React.FC<Props> = ({ transaction, onOpenGraph }) => {
  const { selectedTx, transactions } = useBitcoin();
  const tx = transaction || selectedTx || transactions[0];

  if (!tx) {
    return (
      <div className="bg-[var(--bg-surface)] rounded-xl p-12 text-center border border-[var(--border-subtle)] shadow-sm">
        <Coins className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3 opacity-50" />
        <h3 className="text-base font-semibold text-[var(--text-primary)]">No Transaction Selected</h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">Select a transaction from the Live Feed to inspect its UTXO structure.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Transaction Header Card */}
      <div className="bg-[var(--bg-surface)] rounded-xl p-6 border border-[var(--border-subtle)] shadow-sm transition-colors duration-300">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[var(--border-subtle)] pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]">
                Bitcoin Transaction
              </span>
              <span className="text-xs font-mono text-[var(--text-muted)]">Block #{tx.block_height}</span>
              <span className="text-xs text-[var(--text-muted)] opacity-50">•</span>
              <span className="text-xs text-[var(--text-muted)] flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1 opacity-70" /> {tx.date} {tx.time}
              </span>
            </div>
            <h2 className="text-lg font-mono font-bold text-[var(--text-primary)] break-all">{tx.txid}</h2>
          </div>

          <div className="flex items-center gap-3">
            {onOpenGraph && (
              <button
                onClick={() => onOpenGraph(tx.txid)}
                className="inline-flex items-center text-xs font-semibold text-[var(--network-cyan)] bg-[var(--network-cyan)]/10 px-3 py-2 rounded-lg hover:bg-[var(--network-cyan)]/20 border border-[var(--network-cyan)]/30 transition-colors"
              >
                <GitCommit className="w-4 h-4 mr-1.5" /> View in Graph
              </button>
            )}
            <div className={`px-4 py-2 rounded-lg border text-right ${
              tx.risk_level === 'CRITICAL' ? 'bg-danger-50 border-danger-200 text-danger-800' :
              tx.risk_level === 'HIGH' ? 'bg-orange-50 border-orange-200 text-orange-800' :
              tx.risk_level === 'MEDIUM' ? 'bg-warning-50 border-warning-200 text-warning-800' :
              'bg-success-50 border-success-200 text-success-800'
            }`}>
              <div className="text-[10px] uppercase font-bold tracking-wider">Risk Score</div>
              <div className="text-lg font-extrabold">{tx.risk_score} / 100 ({tx.risk_level})</div>
            </div>
          </div>
        </div>

        {/* Key Metrics Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border-subtle)]">
          <div>
            <span className="text-xs text-[var(--text-muted)] block">Total Transferred</span>
            <span className="text-sm font-mono font-bold text-[var(--text-primary)]">₿ {tx.total_output_btc.toFixed(6)}</span>
          </div>
          <div>
            <span className="text-xs text-[var(--text-muted)] block">Transaction Fee</span>
            <span className="text-sm font-mono font-semibold text-[var(--text-primary)]">₿ {tx.fee_btc.toFixed(6)}</span>
          </div>
          <div>
            <span className="text-xs text-[var(--text-muted)] block">Entity Cluster</span>
            <span className="text-xs font-mono font-semibold text-[var(--behavior-purple)]">{tx.entity_id}</span>
          </div>
          <div>
            <span className="text-xs text-[var(--text-muted)] block">Size / Weight</span>
            <span className="text-xs font-mono text-[var(--text-primary)] opacity-90">{tx.size} B ({tx.weight} WU)</span>
          </div>
        </div>
      </div>

      {/* UTXO Inputs & Outputs Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inputs (Spent UTXOs) */}
        <div className="bg-[var(--bg-surface)] rounded-xl p-5 border border-[var(--border-subtle)] shadow-sm">
          <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>Inputs (Consumed UTXOs)</span>
            <span className="text-xs font-mono text-[var(--text-muted)]">{tx.inputs?.length || 0} inputs</span>
          </h3>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {tx.inputs?.map((inp, i) => (
              <div key={i} className="p-3 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-default)] text-xs transition-all hover:border-[var(--accent-primary)]/40">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono text-[var(--text-primary)] opacity-90 truncate max-w-[200px]" title={inp.address || 'Coinbase'}>
                    {inp.address || 'Coinbase Generation'}
                  </span>
                  <span className="font-mono font-bold text-[var(--text-primary)]">₿ {inp.value_btc.toFixed(6)}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                  <span>Script: <span className="font-semibold text-[var(--text-primary)] opacity-90">{inp.script_type}</span></span>
                  <span className="font-mono truncate max-w-[150px]">Prev: {inp.prev_txid?.slice(0, 8)}...#{inp.prev_vout}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Outputs (Created UTXOs) */}
        <div className="bg-[var(--bg-surface)] rounded-xl p-5 border border-[var(--border-subtle)] shadow-sm">
          <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-3 flex items-center justify-between">
            <span>Outputs (Created UTXOs)</span>
            <span className="text-xs font-mono text-[var(--text-muted)]">{tx.outputs?.length || 0} outputs</span>
          </h3>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {tx.outputs?.map((out, i) => (
              <div key={i} className="p-3 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-default)] text-xs transition-all hover:border-[var(--network-cyan)]/40">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono text-[var(--text-primary)] opacity-90 truncate max-w-[200px]" title={out.address || 'OP_RETURN'}>
                    {out.address || (out.is_op_return ? 'OP_RETURN (Null Data)' : 'Unknown')}
                  </span>
                  <span className="font-mono font-bold text-[var(--success)]">₿ {out.value_btc.toFixed(6)}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                  <span>Script: <span className="font-semibold text-[var(--text-primary)] opacity-90">{out.script_type}</span></span>
                  <span className="text-xs">Vout #{out.vout}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Risk Evidence & Signal Explanation */}
      <div className="bg-[var(--bg-surface)] rounded-xl p-5 border border-[var(--border-subtle)] shadow-sm">
        <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-3 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[var(--accent-primary)]" />
          V.E.C.T.O.R Investigative Evidence & Explanations
        </h3>
        
        <div className="p-4 bg-[var(--accent-primary)]/10 rounded-xl border border-[var(--accent-primary)]/30 text-xs text-[var(--text-primary)] opacity-90 leading-relaxed mb-4">
          <strong className="text-[var(--accent-primary)] font-bold">Analyst Summary:</strong> {tx.explanation}
        </div>

        <div>
          <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-2">Detected Pattern Signals:</span>
          <div className="flex flex-wrap gap-2">
            {tx.signals && tx.signals.length > 0 ? (
              tx.signals.map((sig, i) => (
                <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-default)] shadow-sm">
                  <Tag className="w-3 h-3 mr-1.5 text-[var(--accent-primary)]" /> {sig.replace(/_/g, ' ')}
                </span>
              ))
            ) : (
              <span className="text-xs text-[var(--text-muted)]">Standard behavioral parameters (No anomalies detected)</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BitcoinTransactionExplorer;
