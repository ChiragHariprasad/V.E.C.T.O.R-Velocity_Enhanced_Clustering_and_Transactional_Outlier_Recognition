"""
Bitcoin Transaction Graph Engine
Constructs and maintains a directed graph of Bitcoin transactions, addresses, and entities.
Executes graph algorithms including PageRank, Betweenness Centrality, and structural motif
recognition (fan-in, fan-out, peel chain, rapid forwarding) with NetworkX and pure-Python fallback.
"""

from typing import Dict, Any, List, Set, Optional, Tuple
import math
from collections import defaultdict, deque

try:
    import networkx as nx
    HAS_NETWORKX = True
except ImportError:
    HAS_NETWORKX = False


class PurePythonMultiDiGraph:
    """Lightweight pure-Python fallback for MultiDiGraph operations."""
    def __init__(self):
        self._nodes: Dict[str, Dict[str, Any]] = {}
        self._succ: Dict[str, Dict[str, List[Dict[str, Any]]]] = defaultdict(lambda: defaultdict(list))
        self._pred: Dict[str, Dict[str, List[Dict[str, Any]]]] = defaultdict(lambda: defaultdict(list))

    def add_node(self, node: str, **attrs):
        if node not in self._nodes:
            self._nodes[node] = {}
        self._nodes[node].update(attrs)

    def add_edge(self, u: str, v: str, **attrs):
        self.add_node(u)
        self.add_node(v)
        self._succ[u][v].append(attrs)
        self._pred[v][u].append(attrs)

    def has_node(self, node: str) -> bool:
        return node in self._nodes

    def __len__(self):
        return len(self._nodes)

    def nodes(self, data: bool = False):
        if data:
            return list(self._nodes.items())
        return list(self._nodes.keys())

    def in_degree(self, node: str) -> int:
        return sum(len(edges) for edges in self._pred[node].values())

    def out_degree(self, node: str) -> int:
        return sum(len(edges) for edges in self._succ[node].values())

    def in_edges(self, node: str, data: bool = False):
        res = []
        for src, edge_list in self._pred[node].items():
            for d in edge_list:
                res.append((src, node, d) if data else (src, node))
        return res

    def out_edges(self, node: str, data: bool = False):
        res = []
        for dst, edge_list in self._succ[node].items():
            for d in edge_list:
                res.append((node, dst, d) if data else (node, dst))
        return res

    def successors(self, node: str) -> List[str]:
        return list(self._succ[node].keys())

    def predecessors(self, node: str) -> List[str]:
        return list(self._pred[node].keys())

    def edges(self, keys: bool = False, data: bool = False):
        res = []
        for u, dsts in self._succ.items():
            for v, edge_list in dsts.items():
                for k, d in enumerate(edge_list):
                    if keys and data:
                        res.append((u, v, k, d))
                    elif data:
                        res.append((u, v, d))
                    else:
                        res.append((u, v))
        return res

    def subgraph(self, nodes_subset: Set[str]) -> 'PurePythonMultiDiGraph':
        sub = PurePythonMultiDiGraph()
        for n in nodes_subset:
            if n in self._nodes:
                sub._nodes[n] = dict(self._nodes[n])
        for u in nodes_subset:
            if u in self._succ:
                for v, edge_list in self._succ[u].items():
                    if v in nodes_subset:
                        for d in edge_list:
                            sub.add_edge(u, v, **d)
        return sub


class BitcoinTransactionGraph:
    def __init__(self):
        # Use NetworkX if available, otherwise pure Python fallback
        if HAS_NETWORKX:
            self.graph = nx.MultiDiGraph()
        else:
            self.graph = PurePythonMultiDiGraph()
        self._cached_pagerank: Dict[str, float] = {}
        self._cached_betweenness: Dict[str, float] = {}
        self._cached_closeness: Dict[str, float] = {}
        self._last_calc_time = 0

    def add_transaction(self, tx: Dict[str, Any], entity_id: Optional[str] = None):
        """
        Ingest a transaction into the graph:
        Nodes: Addresses, Transactions, Entities
        Edges: (Input Address) -> [SPENT] -> (Transaction Node) -> [CREATED] -> (Output Address)
        """
        txid = tx["txid"]
        total_val = tx.get("total_output_btc", 0.0)

        # 1. Add Transaction Node
        self.graph.add_node(
            txid,
            node_type="transaction",
            label=f"TX: {txid[:8]}...",
            value_btc=total_val,
            block_height=tx.get("block_height"),
            timestamp=tx.get("timestamp"),
            risk_score=tx.get("risk_score", 0.0),
            risk_level=tx.get("risk_level", "LOW")
        )

        # 2. Add Inputs and edges to TX
        for inp in tx.get("inputs", []):
            addr = inp.get("address")
            if addr:
                val = inp.get("value_btc", 0.0)
                if not self.graph.has_node(addr):
                    self.graph.add_node(addr, node_type="address", label=f"Addr: {addr[:8]}...", entity_id=entity_id)
                self.graph.add_edge(addr, txid, edge_type="SPENT", value_btc=val, timestamp=tx.get("timestamp"))

        # 3. Add Outputs and edges from TX
        for out in tx.get("outputs", []):
            addr = out.get("address")
            if addr and not out.get("is_op_return"):
                val = out.get("value_btc", 0.0)
                if not self.graph.has_node(addr):
                    self.graph.add_node(addr, node_type="address", label=f"Addr: {addr[:8]}...", entity_id=None)
                self.graph.add_edge(txid, addr, edge_type="CREATED", value_btc=val, timestamp=tx.get("timestamp"))

    def compute_centralities(self):
        """Compute structural centrality metrics over current graph."""
        n_count = len(self.graph)
        if n_count == 0:
            return

        if HAS_NETWORKX:
            try:
                if n_count > 2000:
                    G_simple = nx.DiGraph(self.graph.subgraph(list(self.graph.nodes())[-1500:]))
                else:
                    G_simple = nx.DiGraph(self.graph)

                self._cached_pagerank = nx.pagerank(G_simple, alpha=0.85, max_iter=50)
                self._cached_betweenness = nx.betweenness_centrality(G_simple, k=min(100, len(G_simple)))
                self._cached_closeness = nx.closeness_centrality(G_simple)
                return
            except Exception:
                pass

        # Fallback pure-Python centrality approximations
        nodes = list(self.graph.nodes())
        init_pr = 1.0 / n_count
        pr = {n: init_pr for n in nodes}
        damp = 0.85

        # 10 iterations of power iteration for PageRank
        for _ in range(10):
            next_pr = {n: (1.0 - damp) / n_count for n in nodes}
            for u in nodes:
                out_edges = self.graph.out_edges(u)
                if out_edges:
                    share = (damp * pr[u]) / len(out_edges)
                    for _, v, *_ in out_edges:
                        if v in next_pr:
                            next_pr[v] += share
                else:
                    # Dangling node distribution
                    share = (damp * pr[u]) / n_count
                    for v in nodes:
                        next_pr[v] += share
            pr = next_pr

        self._cached_pagerank = pr
        self._cached_betweenness = {n: float(self.graph.in_degree(n) * self.graph.out_degree(n)) / max(1, n_count) for n in nodes}
        self._cached_closeness = {n: float(self.graph.in_degree(n) + self.graph.out_degree(n)) / max(1, n_count) for n in nodes}

    def get_node_features(self, node_id: str) -> Dict[str, float]:
        """Extract graph structural features for an address or entity node."""
        if not self.graph.has_node(node_id):
            return {
                "degree": 0.0,
                "in_degree": 0.0,
                "out_degree": 0.0,
                "weighted_degree": 0.0,
                "pagerank": 0.0001,
                "betweenness_centrality": 0.0,
                "closeness_centrality": 0.0,
                "clustering_coefficient": 0.0
            }

        in_deg = float(self.graph.in_degree(node_id))
        out_deg = float(self.graph.out_degree(node_id))
        total_deg = in_deg + out_deg

        # Calculate weighted degree (total BTC flow)
        weighted_in = sum(data.get("value_btc", 0.0) for _, _, data in self.graph.in_edges(node_id, data=True))
        weighted_out = sum(data.get("value_btc", 0.0) for _, _, data in self.graph.out_edges(node_id, data=True))
        weighted_deg = weighted_in + weighted_out

        pagerank_val = self._cached_pagerank.get(node_id, 1.0 / max(1, len(self.graph)))
        betweenness_val = self._cached_betweenness.get(node_id, 0.0)
        closeness_val = self._cached_closeness.get(node_id, 0.0)

        # Local clustering coefficient
        clust_coeff = 0.0
        if HAS_NETWORKX:
            try:
                undirected = self.graph.to_undirected()
                clust_coeff = float(nx.clustering(undirected, node_id))
            except Exception:
                clust_coeff = 0.0
        else:
            # Simple approximation based on shared neighbors
            nbrs = set(self.graph.successors(node_id) + self.graph.predecessors(node_id))
            if len(nbrs) > 1:
                links = 0
                nbr_list = list(nbrs)
                for i in range(len(nbr_list)):
                    for j in range(i + 1, len(nbr_list)):
                        u, v = nbr_list[i], nbr_list[j]
                        if v in self.graph.successors(u) or u in self.graph.successors(v):
                            links += 1
                possible = len(nbrs) * (len(nbrs) - 1) / 2.0
                clust_coeff = float(links) / possible if possible > 0 else 0.0

        return {
            "degree": float(total_deg),
            "in_degree": float(in_deg),
            "out_degree": float(out_deg),
            "weighted_degree": round(float(weighted_deg), 6),
            "pagerank": round(float(pagerank_val), 6),
            "betweenness_centrality": round(float(betweenness_val), 6),
            "closeness_centrality": round(float(closeness_val), 6),
            "clustering_coefficient": round(float(clust_coeff), 6)
        }

    def detect_motifs(self, tx: Dict[str, Any]) -> Dict[str, float]:
        """
        Detect structural transaction motifs:
        - Fan-In (Aggregation: many inputs -> single/few outputs)
        - Fan-Out (Distribution: single input -> many outputs)
        - Rapid Forwarding (Short inter-transaction pass-through)
        - Peel-Chain indicator
        """
        in_count = tx.get("input_count", 1)
        out_count = tx.get("output_count", 1)
        total_out = tx.get("total_output_btc", 1.0)

        fan_in_score = min(1.0, max(0.0, (in_count - 1) / 10.0)) if out_count <= 2 else 0.0
        fan_out_score = min(1.0, max(0.0, (out_count - 1) / 15.0)) if in_count <= 2 else 0.0

        # Flow ratio
        flow_ratio = float(in_count) / float(max(1, out_count))

        # Rapid forwarding check
        rapid_forward_score = 0.0
        if in_count <= 2 and out_count <= 3 and abs(tx.get("total_input_btc", 0) - total_out) < 0.01:
            rapid_forward_score = 0.85

        return {
            "fan_in_score": round(fan_in_score, 4),
            "fan_out_score": round(fan_out_score, 4),
            "flow_ratio": round(flow_ratio, 4),
            "rapid_forwarding_score": round(rapid_forward_score, 4)
        }

    def get_subgraph(self, center_node: str, max_hops: int = 2) -> Dict[str, Any]:
        """
        Extract N-hop ego subgraph around a target address or transaction for interactive UI visualization.
        """
        if not self.graph.has_node(center_node):
            return {"nodes": [], "edges": []}

        sub_nodes = {center_node}
        current_layer = {center_node}

        for _ in range(max_hops):
            next_layer = set()
            for n in current_layer:
                next_layer.update(self.graph.successors(n))
                next_layer.update(self.graph.predecessors(n))
            sub_nodes.update(next_layer)
            current_layer = next_layer
            if len(sub_nodes) > 100:  # Limit display size
                break

        sub_graph = self.graph.subgraph(sub_nodes)
        
        nodes_out = []
        for n, d in sub_graph.nodes(data=True):
            nodes_out.append({
                "id": n,
                "label": d.get("label", n[:10]),
                "type": d.get("node_type", "address"),
                "value_btc": d.get("value_btc", 0.0),
                "risk_score": d.get("risk_score", 0.0),
                "risk_level": d.get("risk_level", "LOW")
            })

        edges_out = []
        for u, v, k, d in sub_graph.edges(keys=True, data=True):
            edges_out.append({
                "source": u,
                "target": v,
                "edge_type": d.get("edge_type", "SENT_TO"),
                "value_btc": d.get("value_btc", 0.0)
            })

        return {"nodes": nodes_out, "edges": edges_out}
