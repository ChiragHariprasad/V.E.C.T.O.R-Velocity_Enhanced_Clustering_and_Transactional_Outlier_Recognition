"""
Bitcoin Address & Script Extractor
Decodes Bitcoin script types (P2PKH, P2SH, P2WPKH, P2WSH, P2TR, OP_RETURN)
and extracts addresses safely without failing on non-standard scripts.
"""

from typing import Dict, Any, Optional, Tuple

def extract_address_and_type(script_pub_key: Dict[str, Any]) -> Tuple[Optional[str], str]:
    """
    Extract address and script type from a scriptPubKey object.
    Supports P2PKH, P2SH, P2WPKH, P2WSH, P2TR, OP_RETURN.
    """
    if not isinstance(script_pub_key, dict):
        return None, "UNKNOWN"

    script_type = script_pub_key.get("type", "UNKNOWN").upper()
    asm = script_pub_key.get("asm", "")
    address = script_pub_key.get("address")

    if not address and "addresses" in script_pub_key:
        addrs = script_pub_key.get("addresses", [])
        if addrs:
            address = addrs[0]

    # Map Bitcoin Core script type strings to standardized types
    if "OP_RETURN" in asm or script_type == "NULLDATA" or script_type == "NULL_DATA":
        return None, "NULL_DATA"
    elif script_type in ["PUBKEYHASH", "P2PKH"]:
        return address, "P2PKH"
    elif script_type in ["SCRIPTHASH", "P2SH"]:
        return address, "P2SH"
    elif script_type in ["WITNESS_V0_KEYHASH", "P2WPKH", "WITNESS_PUBKEYHASH"]:
        return address, "P2WPKH"
    elif script_type in ["WITNESS_V0_SCRIPTHASH", "P2WSH", "WITNESS_SCRIPTHASH"]:
        return address, "P2WSH"
    elif script_type in ["WITNESS_V1_TAPROOT", "P2TR", "TAPROOT"]:
        return address, "P2TR"
    
    # Fallback heuristic by address prefix if available
    if address:
        if address.startswith("1"):
            return address, "P2PKH"
        elif address.startswith("3"):
            return address, "P2SH"
        elif address.startswith("bc1q") and len(address) == 42:
            return address, "P2WPKH"
        elif address.startswith("bc1q") and len(address) == 62:
            return address, "P2WSH"
        elif address.startswith("bc1p"):
            return address, "P2TR"

    return address, script_type or "UNKNOWN"
