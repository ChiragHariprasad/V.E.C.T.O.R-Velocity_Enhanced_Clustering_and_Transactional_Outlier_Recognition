"""
Bitcoin Transaction Parser
Converts raw JSON-RPC or block transactions into normalized, UTXO-aware internal models.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from bitcoin.address_extractor import extract_address_and_type

class BitcoinTransactionParser:
    @staticmethod
    def parse_transaction(
        raw_tx: Dict[str, Any],
        block_height: Optional[int] = None,
        block_hash: Optional[str] = None,
        block_time: Optional[int] = None,
        status: str = "confirmed"
    ) -> Dict[str, Any]:
        """
        Normalize a raw transaction into V.E.C.T.O.R-BITCOIN internal format.
        """
        txid = raw_tx.get("txid") or raw_tx.get("hash", "")
        tx_time = raw_tx.get("time") or block_time or int(datetime.now(timezone.utc).timestamp())
        dt_obj = datetime.fromtimestamp(tx_time, timezone.utc)
        date_str = dt_obj.strftime("%Y-%m-%d")
        time_str = dt_obj.strftime("%H:%M:%S")

        inputs: List[Dict[str, Any]] = []
        total_input_btc = 0.0

        for vin_idx, vin in enumerate(raw_tx.get("vin", [])):
            prev_txid = vin.get("txid")
            prev_vout = vin.get("vout", 0)
            is_coinbase = "coinbase" in vin
            
            # Extract previous output data if available (verbosity 3 or enriched)
            prevout = vin.get("prevout", {})
            value_btc = float(prevout.get("value", 0.0))
            script_pub_key = prevout.get("scriptPubKey", {})
            addr, script_type = extract_address_and_type(script_pub_key)

            total_input_btc += value_btc

            inputs.append({
                "vin_index": vin_idx,
                "prev_txid": prev_txid,
                "prev_vout": prev_vout,
                "value_btc": round(value_btc, 8),
                "script_type": script_type,
                "address": addr,
                "is_coinbase": is_coinbase,
                "sequence": vin.get("sequence", 4294967295)
            })

        outputs: List[Dict[str, Any]] = []
        total_output_btc = 0.0

        for vout_idx, vout in enumerate(raw_tx.get("vout", [])):
            value_btc = float(vout.get("value", 0.0))
            total_output_btc += value_btc
            script_pub_key = vout.get("scriptPubKey", {})
            addr, script_type = extract_address_and_type(script_pub_key)
            is_op_return = script_type == "NULL_DATA"

            outputs.append({
                "vout": vout.get("n", vout_idx),
                "value_btc": round(value_btc, 8),
                "script_type": script_type,
                "address": addr,
                "is_op_return": is_op_return,
                "spent": False,
                "spent_by_txid": None
            })

        # Calculate fee
        raw_fee = raw_tx.get("fee")
        if raw_fee is not None:
            fee_btc = float(raw_fee)
        elif total_input_btc > 0 and total_input_btc >= total_output_btc:
            fee_btc = total_input_btc - total_output_btc
        else:
            fee_btc = 0.0001  # Safe default fallback

        input_addresses = list(set([inp["address"] for inp in inputs if inp.get("address")]))
        output_addresses = list(set([out["address"] for out in outputs if out.get("address")]))

        return {
            "txid": txid,
            "block_height": block_height,
            "block_hash": block_hash,
            "timestamp": tx_time,
            "date": date_str,
            "time": time_str,
            "version": raw_tx.get("version", 2),
            "size": raw_tx.get("size", 250),
            "vsize": raw_tx.get("vsize", 200),
            "weight": raw_tx.get("weight", 800),
            "locktime": raw_tx.get("locktime", 0),
            "inputs": inputs,
            "outputs": outputs,
            "input_count": len(inputs),
            "output_count": len(outputs),
            "input_addresses": input_addresses,
            "output_addresses": output_addresses,
            "total_input_btc": round(total_input_btc, 8),
            "total_output_btc": round(total_output_btc, 8),
            "fee_btc": round(fee_btc, 8),
            "status": status
        }
