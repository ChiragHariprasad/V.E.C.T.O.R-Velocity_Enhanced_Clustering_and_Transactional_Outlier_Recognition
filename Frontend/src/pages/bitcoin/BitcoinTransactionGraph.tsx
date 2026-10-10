import React, { useState, useEffect } from 'react';
import { 
  Share2, 
  Search, 
  RefreshCw, 
  ArrowRight
} from 'lucide-react';
import { useBitcoin } from '../../context/BitcoinContext';
import { GraphNode } from '../../types/bitcoin';

interface Props {
  initialNodeId?: string | null;
}

const BitcoinTransactionGraph: React.FC<Props> = ({ initialNodeId }) => {
  const { graphData, fetchGraph, entities } = useBitcoin();
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [targetId, setTargetId] = useState(initialNodeId || entities[0]?.entity_id || 'ENT_BTC_001');

  useEffect(() => {
    if (targetId) {
      fetchGraph(targetId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node);
  };

  return (
    <div className="space-y-4">
      {/* Graph Control Bar */}
      <div className="bg-[var(--bg-surface)] rounded-xl p-4 border border-[var(--border-subtle)] shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--network-cyan)]/20 flex items-center justify-center text-[var(--network-cyan)]">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Interactive Transaction & Entity Graph</h2>
            <p className="text-xs text-[var(--text-muted)]">Multi-hop UTXO flow tracing and structural centrality analysis</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Enter Address, TXID or Entity..."
              value={targetId}
              onChange={e => setTargetId(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] outline-none transition-all"
            />
          </div>
          <button
            onClick={() => fetchGraph(targetId)}
            className="text-xs font-bold text-slate-950 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Trace
          </button>
        </div>
      </div>

      {/* Graph Display Canvas + Node Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Canvas Area */}
        <div className="lg:col-span-3 bg-[var(--bg-base)] rounded-2xl p-6 min-h-[540px] border border-[var(--border-subtle)] relative flex flex-col justify-between overflow-hidden shadow-inner">
          {/* Legend Overlay */}
          <div className="flex flex-wrap items-center gap-3 bg-[var(--bg-surface)]/90 backdrop-blur-md px-3 py-2 rounded-xl border border-[var(--border-default)] text-[11px] text-[var(--text-muted)] z-10 w-fit">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[var(--behavior-purple)]"></span> Address Node</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[var(--accent-primary)]"></span> Transaction Node</span>
            <span className="text-[var(--border-strong)]">|</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[var(--risk-critical)]"></span> Critical Risk</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[var(--success)]"></span> Low Risk</span>
          </div>

          {/* Force Graph Nodes Simulation Visualizer */}
          <div className="my-auto py-12 flex flex-wrap justify-center items-center gap-8 relative z-0">
            {graphData.nodes.length === 0 ? (
              <div className="text-center text-[var(--text-muted)] opacity-80">
                <Share2 className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-2 opacity-50" />
                <p className="text-xs">No graph elements to display for this node query.</p>
              </div>
            ) : (
              graphData.nodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                const isTx = node.type === 'transaction';
                const isHigh = node.risk_score && node.risk_score >= 50;

                return (
                  <button
                    key={node.id}
                    onClick={() => handleNodeClick(node)}
                    className={`p-3 rounded-xl transition-all duration-200 text-left border flex flex-col gap-1 shadow-lg transform hover:scale-105 ${
                      isSelected ? 'ring-2 ring-[var(--accent-primary)] scale-110 z-20' : ''
                    } ${
                      isTx 
                        ? 'bg-[var(--accent-primary)]/20 border-[var(--accent-primary)] text-[var(--accent-primary)]' 
                        : (isHigh ? 'bg-[var(--risk-critical)]/20 border-[var(--risk-critical)] text-[var(--risk-critical)]' : 'bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]')
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[10px] uppercase font-bold tracking-wider opacity-80">
                      <span>{node.type}</span>
                      {node.risk_score ? <span>{node.risk_score} pts</span> : null}
                    </div>
                    <div className="font-mono text-xs font-bold truncate max-w-[120px] text-[var(--text-primary)]">{node.label}</div>
                    {node.value_btc ? (
                      <div className="text-[10px] text-[var(--success)] font-mono">₿ {node.value_btc.toFixed(4)}</div>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>

          {/* Graph Status Footer */}
          <div className="flex justify-between items-center text-xs text-[var(--text-muted)] border-t border-[var(--border-subtle)] pt-3 z-10">
            <span>Nodes: {graphData.nodes.length} | Edges: {graphData.edges.length}</span>
            <span className="font-mono text-[11px] text-[var(--accent-primary)]">Centering: {targetId}</span>
          </div>
        </div>

        {/* Selected Node Details Inspector */}
        <div className="bg-[var(--bg-surface)] rounded-xl p-5 border border-[var(--border-subtle)] shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider border-b border-[var(--border-subtle)] pb-2">
            Node Inspector
          </h3>

          {selectedNode ? (
            <div className="space-y-3">
              <div>
                <span className="text-xs text-[var(--text-muted)] block">Identifier</span>
                <span className="text-xs font-mono font-bold text-[var(--text-primary)] break-all">{selectedNode.id}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] p-2.5 rounded-lg">
                  <span className="text-[11px] text-[var(--text-muted)] block">Node Type</span>
                  <span className="text-xs font-bold text-[var(--text-primary)] uppercase">{selectedNode.type}</span>
                </div>
                <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] p-2.5 rounded-lg">
                  <span className="text-[11px] text-[var(--text-muted)] block">Risk Score</span>
                  <span className="text-xs font-bold text-[var(--risk-critical)]">{selectedNode.risk_score ?? 0} / 100</span>
                </div>
              </div>
              <button
                onClick={() => setTargetId(selectedNode.id)}
                className="w-full py-2 text-xs font-semibold text-[var(--text-primary)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated)]/80 border border-[var(--border-default)] rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                Expand 1-Hop Neighbors <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)] py-8 text-center">Click any node in the graph to inspect connections and metadata.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default BitcoinTransactionGraph;
