"""
Bitcoin Core JSON-RPC Client
Provides robust RPC communication with Bitcoin Core full node (mainnet, testnet, regtest)
along with automated synthetic simulation fallback for development and isolated environments.
"""

import json
import logging
import time
import os
import urllib.request
import urllib.error
import base64
import random
import hashlib
from typing import Dict, Any, List, Optional
from bitcoin.config import (
    BITCOIN_RPC_HOST,
    BITCOIN_RPC_PORT,
    BITCOIN_RPC_USER,
    BITCOIN_RPC_PASSWORD,
    RPC_TIMEOUT
)

logger = logging.getLogger("VECTOR.BitcoinRPC")

# Explicit connection status semantics
STATUS_CONNECTED = "CONNECTED"
STATUS_DISCONNECTED = "DISCONNECTED"
STATUS_SIMULATION = "SIMULATION"
STATUS_DEGRADED = "DEGRADED"

# Whitelist of strictly read-only methods. State-altering or signing RPCs are strictly forbidden.
ALLOWED_READONLY_METHODS = {
    "getblockchaininfo",
    "getblockcount",
    "getblockhash",
    "getblock",
    "getrawtransaction",
    "gettxout",
    "getmempoolinfo",
    "getrawmempool",
    "uptime",
}

class BitcoinNodeUnavailableError(ConnectionError):
    """Raised when Bitcoin Core RPC is unreachable and simulation mode is not enabled."""
    pass

class BitcoinRPCMethodForbiddenError(PermissionError):
    """Raised when a non-whitelisted or state-modifying RPC method is attempted."""
    pass

class BitcoinRPCClient:
    def __init__(
        self,
        host: str = BITCOIN_RPC_HOST,
        port: int = BITCOIN_RPC_PORT,
        user: str = BITCOIN_RPC_USER,
        password: str = BITCOIN_RPC_PASSWORD,
        timeout: int = RPC_TIMEOUT,
        force_mock: bool = False,
        simulation_mode: Optional[bool] = None
    ):
        self.host = host
        self.port = port
        self.user = user
        self.password = password
        self.timeout = timeout
        self.url = f"http://{self.host}:{self.port}"
        
        # Simulation mode must be explicitly configured
        env_sim = os.getenv("BITCOIN_SIMULATION_MODE", "false").lower() == "true" or \
                  os.getenv("FORCE_MOCK", "false").lower() == "true"
        self.simulation_mode = force_mock or (simulation_mode if simulation_mode is not None else env_sim)
        self.force_mock = self.simulation_mode
        
        self._status = STATUS_SIMULATION if self.simulation_mode else STATUS_DISCONNECTED
        self._last_error: Optional[str] = None
        self._last_latency_ms: Optional[float] = None
        self._mock_height = 840100

    @property
    def status(self) -> str:
        """Returns the current verified status (CONNECTED, DISCONNECTED, SIMULATION, DEGRADED)."""
        return self._status

    def get_connection_status(self, timeout_override: Optional[float] = 1.5) -> Dict[str, Any]:
        """
        Probe Bitcoin Core node and return verified operational status.
        Never reports fictional connectivity.
        """
        if self.simulation_mode:
            return {
                "status": STATUS_SIMULATION,
                "network": "regtest",
                "height": self._mock_height,
                "headers": self._mock_height,
                "verificationprogress": 1.0,
                "mempool_size": 0,
                "mempool_bytes": 0,
                "latency_ms": 0.05,
                "error": None,
                "read_only": True,
                "node": {
                    "status": STATUS_SIMULATION,
                    "height": self._mock_height
                },
                "mempool": {
                    "status": "SIMULATION",
                    "count": 0,
                    "bytes": 0
                }
            }

        t_start = time.perf_counter()
        req_timeout = timeout_override if timeout_override is not None else self.timeout
        try:
            info = self._execute_rpc("getblockchaininfo", [], timeout=req_timeout)
            latency_ms = round((time.perf_counter() - t_start) * 1000, 2)
            self._last_latency_ms = latency_ms

            progress = float(info.get("verificationprogress", 1.0))
            chain = str(info.get("chain", "unknown"))
            is_degraded = progress < 0.999
            self._status = STATUS_DEGRADED if is_degraded else STATUS_CONNECTED
            self._last_error = None

            # Attempt read-only mempool info
            mempool_size = None
            mempool_bytes = None
            try:
                mp = self._execute_rpc("getmempoolinfo", [], timeout=req_timeout)
                mempool_size = mp.get("size")
                mempool_bytes = mp.get("bytes")
            except Exception:
                pass

            return {
                "status": self._status,
                "network": chain,
                "height": info.get("blocks"),
                "headers": info.get("headers"),
                "verificationprogress": progress,
                "mempool_size": mempool_size,
                "mempool_bytes": mempool_bytes,
                "latency_ms": latency_ms,
                "error": None,
                "read_only": True,
                "node": {
                    "status": self._status,
                    "height": info.get("blocks")
                },
                "mempool": {
                    "status": "AVAILABLE" if mempool_size is not None else "UNAVAILABLE",
                    "count": mempool_size,
                    "bytes": mempool_bytes
                }
            }
        except Exception as e:
            self._status = STATUS_DISCONNECTED
            self._last_error = str(e)
            return {
                "status": STATUS_DISCONNECTED,
                "network": "unknown",
                "height": None,
                "headers": None,
                "verificationprogress": None,
                "mempool_size": None,
                "mempool_bytes": None,
                "latency_ms": None,
                "error": str(e),
                "read_only": True,
                "node": {
                    "status": STATUS_DISCONNECTED,
                    "height": None
                },
                "mempool": {
                    "status": "UNAVAILABLE",
                    "count": None,
                    "bytes": None
                }
            }

    def call(self, method: str, params: Optional[List[Any]] = None) -> Any:
        """Execute a read-only JSON-RPC method call to Bitcoin Core."""
        return self._call(method, params)

    def _call(self, method: str, params: Optional[List[Any]] = None) -> Any:
        """Execute a read-only JSON-RPC method call to Bitcoin Core."""
        # Read-only guard: block write/sign operations
        if method not in ALLOWED_READONLY_METHODS:
            raise BitcoinRPCMethodForbiddenError(
                f"Method '{method}' is forbidden. V.E.C.T.O.R BitcoinRPCClient is strictly read-only."
            )

        if self.simulation_mode:
            return self._mock_call(method, params or [])

        try:
            return self._execute_rpc(method, params or [], timeout=self.timeout)
        except (urllib.error.URLError, TimeoutError, ConnectionRefusedError, OSError) as e:
            self._status = STATUS_DISCONNECTED
            self._last_error = str(e)
            # NEVER silently fall back to mock data
            raise BitcoinNodeUnavailableError(
                f"Bitcoin Core node not reachable at {self.url} for '{method}': {e}"
            ) from e

    def _execute_rpc(self, method: str, params: List[Any], timeout: float) -> Any:
        """Direct low-level HTTP JSON-RPC execution."""
        payload = json.dumps({
            "jsonrpc": "2.0",
            "id": "vector_rpc",
            "method": method,
            "params": params
        }).encode("utf-8")

        req = urllib.request.Request(self.url, data=payload, headers={"Content-Type": "application/json"})
        if self.user and self.password:
            auth_str = f"{self.user}:{self.password}".encode("utf-8")
            req.add_header("Authorization", f"Basic {base64.b64encode(auth_str).decode('utf-8')}")

        with urllib.request.urlopen(req, timeout=timeout) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            if res_data.get("error"):
                raise RuntimeError(f"RPC Error [{method}]: {res_data['error']}")
            return res_data.get("result")

    def get_blockchain_info(self) -> Dict[str, Any]:
        return self._call("getblockchaininfo")

    def get_block_count(self) -> int:
        return self._call("getblockcount")

    def get_block_hash(self, height: int) -> str:
        return self._call("getblockhash", [height])

    def get_block(self, block_hash: str, verbosity: int = 2) -> Dict[str, Any]:
        """
        Verbosity 2 returns transaction details.
        Verbosity 3 returns previous output info if available.
        """
        return self._call("getblock", [block_hash, verbosity])

    def get_raw_transaction(self, txid: str, verbose: bool = True) -> Dict[str, Any]:
        return self._call("getrawtransaction", [txid, verbose])

    def get_tx_out(self, txid: str, vout: int) -> Optional[Dict[str, Any]]:
        return self._call("gettxout", [txid, vout])

    def get_mempool_info(self) -> Dict[str, Any]:
        return self._call("getmempoolinfo")

    def get_raw_mempool(self) -> List[str]:
        return self._call("getrawmempool")

    # ========== Built-in Realistic Simulation Generator ==========
    def _mock_call(self, method: str, params: List[Any]) -> Any:
        if method == "getblockchaininfo":
            return {
                "chain": "regtest",
                "blocks": self._mock_height,
                "headers": self._mock_height,
                "bestblockhash": hashlib.sha256(str(self._mock_height).encode()).hexdigest(),
                "difficulty": 1.0,
                "mediantime": int(time.time()) - 600,
                "verificationprogress": 1.0,
                "pruned": False
            }
        elif method == "getblockcount":
            self._mock_height += 1
            return self._mock_height
        elif method == "getblockhash":
            height = params[0] if params else self._mock_height
            return hashlib.sha256(f"block_{height}".encode()).hexdigest()
        elif method == "getblock":
            block_hash = params[0]
            height = self._mock_height
            return self._generate_mock_block(block_hash, height)
        elif method == "getmempoolinfo":
            return {
                "loaded": True,
                "size": random.randint(150, 2500),
                "bytes": random.randint(500000, 10000000),
                "usage": random.randint(1000000, 15000000),
                "maxmempool": 300000000,
                "mempoolminfee": 0.00001
            }
        elif method == "getrawmempool":
            return [hashlib.sha256(f"mempool_tx_{i}".encode()).hexdigest() for i in range(10)]
        return {}

    def _generate_mock_block(self, block_hash: str, height: int) -> Dict[str, Any]:
        now = int(time.time())
        num_txs = random.randint(8, 20)
        txs = []
        
        sample_addresses = [
            "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
            "bc1q9d4j20f28euehwh3k7e2x9v48q983dhh484d8s",
            "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
            "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",
            "bc1p5d7rjq7g6rd2ee07nvz5fqxs5zj0qq7587tw4w",
            "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
            "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
        ]

        for i in range(num_txs):
            txid = hashlib.sha256(f"{block_hash}_tx_{i}_{random.random()}".encode()).hexdigest()
            in_addr = random.choice(sample_addresses)
            out_addr1 = random.choice(sample_addresses)
            out_addr2 = random.choice(sample_addresses)
            val = round(random.uniform(0.01, 15.5), 6)
            
            txs.append({
                "txid": txid,
                "hash": txid,
                "version": 2,
                "size": random.randint(200, 450),
                "vsize": random.randint(160, 380),
                "weight": random.randint(600, 1500),
                "locktime": 0,
                "vin": [
                    {
                        "txid": hashlib.sha256(f"prev_{i}_{random.random()}".encode()).hexdigest(),
                        "vout": 0,
                        "scriptSig": {"asm": "", "hex": ""},
                        "sequence": 4294967295,
                        "prevout": {
                            "value": val + round(random.uniform(0.0001, 0.001), 6),
                            "scriptPubKey": {
                                "asm": f"OP_DUP OP_HASH160 {in_addr} OP_EQUALVERIFY OP_CHECKSIG",
                                "hex": "76a914...",
                                "type": "pubkeyhash",
                                "address": in_addr
                            }
                        }
                    }
                ],
                "vout": [
                    {
                        "value": round(val * 0.9, 6),
                        "n": 0,
                        "scriptPubKey": {
                            "asm": f"OP_DUP OP_HASH160 {out_addr1} OP_EQUALVERIFY OP_CHECKSIG",
                            "hex": "76a914...",
                            "type": "pubkeyhash",
                            "address": out_addr1
                        }
                    },
                    {
                        "value": round(val * 0.1, 6),
                        "n": 1,
                        "scriptPubKey": {
                            "asm": f"OP_DUP OP_HASH160 {out_addr2} OP_EQUALVERIFY OP_CHECKSIG",
                            "hex": "76a914...",
                            "type": "pubkeyhash",
                            "address": out_addr2
                        }
                    }
                ],
                "fee": round(random.uniform(0.00005, 0.0003), 6)
            })

        return {
            "hash": block_hash,
            "confirmations": 1,
            "height": height,
            "version": 536870912,
            "time": now,
            "mediantime": now - 60,
            "nonce": random.randint(1000000, 9999999),
            "bits": "1a00ffff",
            "difficulty": 1.0,
            "nTx": len(txs),
            "previousblockhash": hashlib.sha256(f"prev_block_{height-1}".encode()).hexdigest(),
            "tx": txs
        }
