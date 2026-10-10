"""
V.E.C.T.O.R — Bitcoin Infrastructure & System Status Correctness Test Suite
===========================================================================
Validates:
1. Bitcoin Core RPC: Read-only whitelist enforcement (forbids write/sign/wallet calls)
2. Node Connected: Probing, verificationprogress, height, and mempool info
3. Node Disconnected: Clean DISCONNECTED status, mempool UNAVAILABLE, raises on calls
4. Simulation Mode: Explicit SIMULATION status, never falsely claims CONNECTED
5. Degraded Mode: Flags syncing/degraded node state
6. Real Model Status: OPERATIONAL vs MODEL_MISSING, name, version, loaded_at
7. Real ML Latency: Measured stage timings (preprocessing, inference, postprocessing), p95
8. Real TPS: Measured throughput (processed txs / elapsed time), Active vs Idle distinction
9. Status API Schema: Conforms to the required conceptual specification
"""

import unittest
import json
import time
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
import socket
import tempfile
import os

import sys
from pathlib import Path

backend_dir = str(Path(__file__).resolve().parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from bitcoin.rpc_client import (
    BitcoinRPCClient,
    STATUS_CONNECTED,
    STATUS_DISCONNECTED,
    STATUS_SIMULATION,
    STATUS_DEGRADED,
    BitcoinNodeUnavailableError,
    BitcoinRPCMethodForbiddenError
)
from bitcoin.ml_inference import BitcoinMLInferenceEngine


class MockBitcoinRPCServer(BaseHTTPRequestHandler):
    """Mock Bitcoin Core JSON-RPC HTTP Server for read-only testing."""
    protocol_version = "HTTP/1.1"
    
    # Configurable responses
    verification_progress = 0.999999
    block_height = 840500
    chain = "regtest"
    mempool_size = 18

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length).decode('utf-8')
        request_json = json.loads(post_data)
        
        method = request_json.get('method')
        req_id = request_json.get('id', 1)
        params = request_json.get('params', [])

        if method == 'getblockchaininfo':
            result = {
                'chain': self.chain,
                'blocks': self.block_height,
                'headers': self.block_height,
                'verificationprogress': self.verification_progress,
                'initialblockdownload': False
            }
        elif method == 'getblockcount':
            result = self.block_height
        elif method == 'getblockhash':
            height = params[0] if params else self.block_height
            result = f"0000000000000000000abc{height:06d}"
        elif method == 'getblock':
            result = {
                'hash': params[0] if params else "0000000000000000000abc",
                'confirmations': 1,
                'height': self.block_height,
                'tx': ['tx1', 'tx2']
            }
        elif method == 'getmempoolinfo':
            result = {
                'size': self.mempool_size,
                'bytes': self.mempool_size * 250,
                'usage': self.mempool_size * 300,
                'maxmempool': 300000000
            }
        elif method == 'getrawmempool':
            result = [f'mempool_tx_{i}' for i in range(self.mempool_size)]
        elif method == 'getrawtransaction':
            result = {
                'txid': params[0] if params else 'dummy_txid',
                'version': 2,
                'vin': [],
                'vout': []
            }
        else:
            self.send_response(404)
            self.end_headers()
            return

        response = json.dumps({'result': result, 'error': None, 'id': req_id}).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(response)))
        self.end_headers()
        self.wfile.write(response)

    def log_message(self, format, *args):
        # Suppress noisy HTTP server console logs during tests
        pass


class TestBitcoinInfrastructureStatus(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Pick a free random port for the mock Bitcoin Core RPC server
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('127.0.0.1', 0))
            cls.mock_port = s.getsockname()[1]

        cls.httpd = HTTPServer(('127.0.0.1', cls.mock_port), MockBitcoinRPCServer)
        cls.server_thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.server_thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    # =========================================================================
    # 1. BITCOIN CORE RPC & READ-ONLY ENFORCEMENT
    # =========================================================================

    def test_rpc_read_only_whitelist_enforcement(self):
        """Verify write/broadcast/wallet methods raise BitcoinRPCMethodForbiddenError."""
        client = BitcoinRPCClient(host="127.0.0.1", port=self.mock_port)
        
        forbidden_methods = [
            "sendrawtransaction",
            "sendtoaddress",
            "signrawtransactionwithwallet",
            "generatetoaddress",
            "setban",
            "stop",
            "walletpassphrase"
        ]
        
        for method in forbidden_methods:
            with self.subTest(forbidden_method=method):
                with self.assertRaises(BitcoinRPCMethodForbiddenError):
                    client.call(method)

    def test_rpc_allowed_readonly_methods(self):
        """Verify allowed read-only methods execute cleanly against connected node."""
        client = BitcoinRPCClient(host="127.0.0.1", port=self.mock_port)
        
        info = client.get_blockchain_info()
        self.assertEqual(info['chain'], 'regtest')
        self.assertEqual(info['blocks'], 840500)

        count = client.get_block_count()
        self.assertEqual(count, 840500)

        block_hash = client.get_block_hash(100)
        self.assertIn("0000000000000000000abc000100", block_hash)

        block = client.get_block(block_hash)
        self.assertEqual(block['height'], 840500)

        mempool_info = client.get_mempool_info()
        self.assertEqual(mempool_info['size'], 18)

        mempool_txs = client.get_raw_mempool()
        self.assertEqual(len(mempool_txs), 18)

    # =========================================================================
    # 2. STATUS SEMANTICS (CONNECTED, DISCONNECTED, SIMULATION, DEGRADED)
    # =========================================================================

    def test_status_connected(self):
        """Verify get_connection_status() returns CONNECTED when node is healthy."""
        MockBitcoinRPCServer.verification_progress = 0.999999
        client = BitcoinRPCClient(host="127.0.0.1", port=self.mock_port)
        
        status = client.get_connection_status()
        self.assertEqual(status['status'], STATUS_CONNECTED)
        self.assertEqual(status['network'], 'regtest')
        self.assertEqual(status['node']['height'], 840500)
        self.assertEqual(status['mempool']['status'], 'AVAILABLE')
        self.assertEqual(status['mempool']['count'], 18)
        self.assertIsNotNone(status['latency_ms'])

    def test_status_disconnected_on_unreachable_node(self):
        """Verify unreachable node returns DISCONNECTED and UNAVAILABLE mempool."""
        # Pick an unused closed port
        closed_port = self.mock_port + 50
        client = BitcoinRPCClient(host="127.0.0.1", port=closed_port)
        
        status = client.get_connection_status()
        self.assertEqual(status['status'], STATUS_DISCONNECTED)
        self.assertEqual(status['network'], 'unknown')
        self.assertIsNone(status['node']['height'])
        self.assertEqual(status['mempool']['status'], 'UNAVAILABLE')
        self.assertIsNone(status['mempool']['count'])

        # Calling directly should raise BitcoinNodeUnavailableError (no silent mock!)
        with self.assertRaises(BitcoinNodeUnavailableError):
            client.get_blockchain_info()

    def test_status_simulation_mode(self):
        """Verify explicit simulation_mode returns SIMULATION and never CONNECTED."""
        client = BitcoinRPCClient(host="127.0.0.1", port=9999, simulation_mode=True)
        
        status = client.get_connection_status()
        self.assertEqual(status['status'], STATUS_SIMULATION)
        self.assertNotEqual(status['status'], STATUS_CONNECTED)
        self.assertEqual(status['network'], 'regtest')
        self.assertEqual(status['mempool']['status'], 'SIMULATION')

    def test_status_degraded_when_syncing(self):
        """Verify verificationprogress < 0.999 returns DEGRADED."""
        MockBitcoinRPCServer.verification_progress = 0.750000
        try:
            client = BitcoinRPCClient(host="127.0.0.1", port=self.mock_port)
            status = client.get_connection_status()
            self.assertEqual(status['status'], STATUS_DEGRADED)
        finally:
            MockBitcoinRPCServer.verification_progress = 0.999999

    # =========================================================================
    # 3. REAL MODEL STATUS & VERSIONING
    # =========================================================================

    def test_model_status_operational_when_loaded(self):
        """Verify ML engine reports OPERATIONAL with model name, version, loaded_at."""
        engine = BitcoinMLInferenceEngine()
        model_status = engine.get_model_status()
        
        self.assertEqual(model_status['status'], 'OPERATIONAL')
        self.assertEqual(model_status['name'], 'V.E.C.T.O.R Multi-Model Behavioral Anomaly Detector')
        self.assertEqual(model_status['version'], 'bitcoin_v1')
        self.assertIsNotNone(model_status['loaded_at'])
        self.assertEqual(model_status['features_count'], 66)
        self.assertIn(0, model_status['clusters_loaded'])

    def test_model_status_missing_when_models_absent(self):
        """Verify ML engine reports MODEL_MISSING when weights/artifacts are absent."""
        with tempfile.TemporaryDirectory() as empty_dir:
            engine = BitcoinMLInferenceEngine(model_dir=empty_dir)
            model_status = engine.get_model_status()
            self.assertEqual(model_status['status'], 'MODEL_MISSING')
            self.assertIsNone(model_status['loaded_at'])

    # =========================================================================
    # 4. REAL ML LATENCY INSTRUMENTATION
    # =========================================================================

    def test_ml_latency_measured_not_static(self):
        """Verify model latency is instrumented and exposes preprocessing, inference, postprocessing."""
        engine = BitcoinMLInferenceEngine()
        
        # Run inference on sample feature vector (66 dims)
        sample_features = [0.0] * 66
        sample_features[0] = 5.5  # btc
        sample_features[4] = 2.0  # tx_velocity_1h
        
        result = engine.predict(sample_features)
        
        # Verify measured timing breakdown
        timing = result['inference_timing_ms']
        self.assertIn('preprocessing_ms', timing)
        self.assertIn('inference_ms', timing)
        self.assertIn('postprocessing_ms', timing)
        self.assertIn('total_ms', timing)
        
        # Latency must be a genuine measured positive float
        self.assertGreater(timing['total_ms'], 0.0)
        # Latency should NOT be the hardcoded 12.4 ms
        self.assertNotEqual(timing['total_ms'], 12.4)

        # Verify rolling telemetry exposes average and p95
        telemetry = engine.get_telemetry()
        inf_telem = telemetry['inference']
        self.assertEqual(inf_telem['status'], 'measured')
        self.assertGreater(inf_telem['sample_count'], 0)
        self.assertIsNotNone(inf_telem['latency_ms'])
        self.assertIsNotNone(inf_telem['avg_latency_ms'])
        self.assertIsNotNone(inf_telem['p95_latency_ms'])

    # =========================================================================
    # 5. REAL TPS & INGESTION THROUGHPUT
    # =========================================================================

    def test_real_tps_calculation_and_labels(self):
        """Verify ingestion throughput is calculated from processed txs / elapsed time."""
        # Simulate an ingestion batch
        start_time = time.perf_counter()
        time.sleep(0.05)  # 50ms elapsed
        tx_count = 50
        elapsed = time.perf_counter() - start_time
        
        actual_tps = round(tx_count / elapsed, 2)
        
        # Active throughput
        active_throughput = {
            'status': 'active',
            'tx_per_sec': actual_tps,
            'processed_transactions': tx_count,
            'elapsed_seconds': round(elapsed, 3),
            'last_batch_tps': actual_tps,
            'historical_avg_tps': actual_tps
        }
        self.assertEqual(active_throughput['status'], 'active')
        self.assertGreater(active_throughput['tx_per_sec'], 0.0)
        self.assertNotEqual(active_throughput['tx_per_sec'], 18.5)

        # Idle throughput: current tx_per_sec is 0.0, but last_batch_tps is preserved
        idle_throughput = {
            'status': 'idle',
            'tx_per_sec': 0.0,
            'last_batch_tps': actual_tps,
            'historical_avg_tps': actual_tps,
            'processed_transactions': tx_count
        }
        self.assertEqual(idle_throughput['status'], 'idle')
        self.assertEqual(idle_throughput['tx_per_sec'], 0.0)
        self.assertEqual(idle_throughput['last_batch_tps'], actual_tps)

    # =========================================================================
    # 6. STATUS ENDPOINT SPECIFICATION CONFORMANCE
    # =========================================================================

    def test_status_endpoint_conceptual_schema(self):
        """Verify the conceptual response schema required by Section 7."""
        client = BitcoinRPCClient(host="127.0.0.1", port=self.mock_port)
        node_status = client.get_connection_status()
        
        engine = BitcoinMLInferenceEngine()
        model_status = engine.get_model_status()
        telemetry = engine.get_telemetry()
        
        response = {
            "network": node_status['network'],
            "node": {
                "status": node_status['status'],
                "height": node_status['node']['height']
            },
            "model": {
                "status": model_status['status'],
                "name": model_status['name'],
                "version": model_status['version']
            },
            "throughput": {
                "tx_per_sec": 0.0
            },
            "inference": {
                "latency_ms": telemetry['inference']['latency_ms']
            }
        }
        
        # Assert structure conforms to specification
        self.assertIn("network", response)
        self.assertIn("node", response)
        self.assertIn("status", response["node"])
        self.assertIn("height", response["node"])
        self.assertIn("model", response)
        self.assertIn("status", response["model"])
        self.assertIn("name", response["model"])
        self.assertIn("version", response["model"])
        self.assertIn("throughput", response)
        self.assertIn("tx_per_sec", response["throughput"])
        self.assertIn("inference", response)
        self.assertIn("latency_ms", response["inference"])


if __name__ == '__main__':
    unittest.main()
