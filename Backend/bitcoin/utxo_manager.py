"""
Bitcoin UTXO Manager & State Tracker
Maintains the unspent transaction output state, computes UTXO age statistics,
spending velocity, fragmentation, and input-output linkage.
"""

from typing import Dict, Any, List, Optional
import time

class UTXOManager:
    def __init__(self):
        # In-memory UTXO cache keyed by "txid:vout"
        self._utxo_cache: Dict[str, Dict[str, Any]] = {}
        # Address balance cache
        self._address_utxos: Dict[str, List[str]] = {}

    def process_transaction(self, tx: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process transaction inputs (spending previous UTXOs) and outputs (creating new UTXOs).
        Returns calculated UTXO statistics for feature engineering.
        """
        txid = tx["txid"]
        block_height = tx.get("block_height")
        current_time = tx.get("timestamp") or int(time.time())

        spent_utxo_ages = []
        spent_utxo_values = []

        # 1. Spend inputs
        for i, inp in enumerate(tx.get("inputs", [])):
            if inp.get("is_coinbase"):
                continue
            prev_txid = inp.get("prev_txid") or f"prev_{txid}_{i}"
            prev_vout = inp.get("prev_vout", i)
            prev_key = f"{prev_txid}:{prev_vout}"
            if prev_key in self._utxo_cache:
                utxo = self._utxo_cache[prev_key]
                utxo["spent"] = True
                utxo["spent_by_txid"] = txid
                utxo["spent_height"] = block_height
                
                # Calculate age in blocks if block height is known
                if block_height is not None and utxo.get("created_height") is not None:
                    age_blocks = max(0, block_height - utxo.get("created_height"))
                    spent_utxo_ages.append(age_blocks)
                spent_utxo_values.append(utxo.get("value_btc", 0.0))
                
                # Remove from address mapping
                addr = utxo.get("address")
                if addr and addr in self._address_utxos and prev_key in self._address_utxos[addr]:
                    self._address_utxos[addr].remove(prev_key)

        # 2. Create new outputs
        for i, out in enumerate(tx.get("outputs", [])):
            if out.get("is_op_return"):
                continue
            vout = out.get("vout", i)
            out_key = f"{txid}:{vout}"
            utxo_entry = {
                "utxo_id": out_key,
                "txid": txid,
                "vout": vout,
                "value_btc": float(out.get("value_btc", 0.0)),
                "address": out.get("address"),
                "script_type": out.get("script_type", "UNKNOWN"),
                "created_height": block_height,
                "created_time": current_time,
                "spent": False,
                "spent_by_txid": None
            }
            self._utxo_cache[out_key] = utxo_entry
            
            addr = out.get("address")
            if addr:
                if addr not in self._address_utxos:
                    self._address_utxos[addr] = []
                self._address_utxos[addr].append(out_key)

        # 3. Compute UTXO metrics
        avg_age = float(sum(spent_utxo_ages) / len(spent_utxo_ages)) if spent_utxo_ages else None
        median_age = float(sorted(spent_utxo_ages)[len(spent_utxo_ages)//2]) if spent_utxo_ages else None
        old_ratio = (sum(1 for age in spent_utxo_ages if age > 144) / len(spent_utxo_ages)) if spent_utxo_ages else 0.0
        young_ratio = (sum(1 for age in spent_utxo_ages if age <= 6) / len(spent_utxo_ages)) if spent_utxo_ages else 0.0
        fragmentation = len(tx.get("outputs", [])) / max(1.0, tx.get("total_output_btc", 1.0))

        return {
            "avg_utxo_age_blocks": round(avg_age, 2) if avg_age is not None else 0.0,
            "median_utxo_age_blocks": round(median_age, 2) if median_age is not None else 0.0,
            "old_utxo_spending_ratio": round(old_ratio, 4),
            "young_utxo_spending_ratio": round(young_ratio, 4),
            "utxo_fragmentation": round(fragmentation, 4),
            "spent_utxo_count": len(spent_utxo_ages)
        }

    def get_address_balance(self, address: str) -> float:
        """Derive address balance from active unspent UTXOs."""
        keys = self._address_utxos.get(address, [])
        total = 0.0
        for k in keys:
            utxo = self._utxo_cache.get(k)
            if utxo and not utxo.get("spent"):
                total += utxo.get("value_btc", 0.0)
        return round(total, 8)
