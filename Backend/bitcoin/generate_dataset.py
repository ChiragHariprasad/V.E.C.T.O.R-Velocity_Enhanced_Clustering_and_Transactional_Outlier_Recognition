"""
V.E.C.T.O.R-BITCOIN Synthetic Dataset Generator
Generates a realistic synthetic Bitcoin P2P/transaction dataset with ALL fields
required by the NTRO problem statement:
  timestamp, src_ip, dst_ip, src_port, dst_port, txid,
  input_addresses[], output_addresses[], input_amounts[], output_amounts[],
  fee, input_count, output_count, geo_country, ASN

Embeds laundering patterns: peel chains, CoinJoin, fan-in/fan-out, rapid forwarding.
"""

import os
import csv
import json
import hashlib
import random
import time
import math
import argparse
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple

# ---------------------------------------------------------------------------
# GeoIP Lookup Table (bundled — no external API needed)
# ---------------------------------------------------------------------------
GEOIP_TABLE: List[Dict[str, Any]] = [
    {"country": "US", "asn": "AS15169", "label": "Google LLC",         "ip_prefix": "34."},
    {"country": "US", "asn": "AS16509", "label": "Amazon AWS",         "ip_prefix": "54."},
    {"country": "US", "asn": "AS14618", "label": "Amazon East",        "ip_prefix": "52."},
    {"country": "DE", "asn": "AS24940", "label": "Hetzner Online",     "ip_prefix": "95.216."},
    {"country": "NL", "asn": "AS60781", "label": "LeaseWeb NL",        "ip_prefix": "178.162."},
    {"country": "RU", "asn": "AS49505", "label": "Selectel RU",        "ip_prefix": "185.22."},
    {"country": "CN", "asn": "AS45090", "label": "Shenzhen Tencent",   "ip_prefix": "119.29."},
    {"country": "SG", "asn": "AS16509", "label": "AWS Singapore",      "ip_prefix": "13.250."},
    {"country": "GB", "asn": "AS20473", "label": "Vultr London",       "ip_prefix": "45.63."},
    {"country": "JP", "asn": "AS2519",  "label": "ARTERIA Networks",   "ip_prefix": "163.44."},
    {"country": "RO", "asn": "AS9009",  "label": "M247 Ltd",           "ip_prefix": "185.56."},
    {"country": "CH", "asn": "AS51852", "label": "Private Layer",      "ip_prefix": "179.43."},
    {"country": "UA", "asn": "AS28907", "label": "MIROHOST",           "ip_prefix": "91.236."},
    {"country": "BR", "asn": "AS28573", "label": "Claro SA",           "ip_prefix": "189.1."},
    {"country": "IN", "asn": "AS55836", "label": "Reliance Jio",       "ip_prefix": "49.36."},
    {"country": "CA", "asn": "AS54113", "label": "Fastly",             "ip_prefix": "151.101."},
    {"country": "FR", "asn": "AS16276", "label": "OVH SAS",            "ip_prefix": "51.77."},
    {"country": "AU", "asn": "AS7545",  "label": "TPG Telecom",        "ip_prefix": "203.29."},
    {"country": "KR", "asn": "AS4766",  "label": "Korea Telecom",      "ip_prefix": "175.45."},
    {"country": "NG", "asn": "AS37148", "label": "Spectranet",         "ip_prefix": "197.210."},
    # Tor exit node ranges (synthetic)
    {"country": "XX", "asn": "AS0",     "label": "Tor Exit Node",      "ip_prefix": "10.255."},
    {"country": "XX", "asn": "AS0",     "label": "Tor Exit Node",      "ip_prefix": "10.254."},
]

# Common Bitcoin address prefixes for realistic generation
ADDR_PREFIXES = [
    "bc1q",   # Bech32 (SegWit P2WPKH)
    "bc1p",   # Bech32m (Taproot P2TR)
    "1",      # Legacy P2PKH
    "3",      # P2SH (multisig / wrapped SegWit)
]

SCRIPT_TYPES = ["P2PKH", "P2SH", "P2WPKH", "P2WSH", "P2TR"]


def _sha256(data: str) -> str:
    return hashlib.sha256(data.encode()).hexdigest()


def _random_btc_address(prefix: str = None, seed: str = None) -> str:
    if prefix is None:
        prefix = random.choice(ADDR_PREFIXES)
    raw = seed or f"{random.random()}{time.time()}"
    h = _sha256(raw)
    if prefix.startswith("bc1"):
        return prefix + h[:38]
    elif prefix == "1":
        return "1" + h[:33]
    else:
        return "3" + h[:33]


def _random_ip(geo: Dict[str, Any] = None) -> str:
    if geo is None:
        geo = random.choice(GEOIP_TABLE)
    prefix = geo["ip_prefix"]
    parts = prefix.rstrip(".").split(".")
    while len(parts) < 4:
        parts.append(str(random.randint(1, 254)))
    return ".".join(parts[:4])


def _random_port() -> int:
    return random.choice([8333, 18333, 18444, 38333]) if random.random() < 0.7 else random.randint(10000, 65535)


# ---------------------------------------------------------------------------
# Entity Archetypes
# ---------------------------------------------------------------------------
class EntityArchetype:
    NORMAL = "normal"
    SUSPICIOUS = "suspicious"
    ILLICIT = "illicit"


def _create_entity_pool(n_entities: int = 60) -> List[Dict[str, Any]]:
    """Create a pool of simulated entities with addresses and IP associations."""
    entities = []
    for i in range(n_entities):
        # 60% normal, 25% suspicious, 15% illicit
        r = random.random()
        if r < 0.60:
            archetype = EntityArchetype.NORMAL
        elif r < 0.85:
            archetype = EntityArchetype.SUSPICIOUS
        else:
            archetype = EntityArchetype.ILLICIT

        geo = random.choice(GEOIP_TABLE)
        n_addrs = random.randint(2, 8) if archetype != EntityArchetype.NORMAL else random.randint(1, 4)

        addresses = [_random_btc_address(seed=f"entity_{i}_addr_{j}") for j in range(n_addrs)]
        ips = [_random_ip(geo) for _ in range(random.randint(1, 3))]

        # Illicit entities may use Tor
        if archetype == EntityArchetype.ILLICIT and random.random() < 0.5:
            tor_geo = [g for g in GEOIP_TABLE if g["country"] == "XX"]
            if tor_geo:
                ips.append(_random_ip(random.choice(tor_geo)))

        entities.append({
            "entity_id": f"ENT_{_sha256(f'entity_{i}')[:12].upper()}",
            "archetype": archetype,
            "addresses": addresses,
            "ips": ips,
            "geo": geo,
            "label": f"Entity-{i:04d} ({archetype})",
            "is_seed_illicit": archetype == EntityArchetype.ILLICIT,
        })
    return entities


# ---------------------------------------------------------------------------
# Transaction Pattern Generators
# ---------------------------------------------------------------------------

def _gen_normal_tx(entities: List[Dict], ts: float, idx: int) -> Dict[str, Any]:
    """Standard 1-in, 2-out transaction."""
    sender = random.choice([e for e in entities if e["archetype"] == EntityArchetype.NORMAL] or entities)
    receiver = random.choice(entities)
    amount = round(random.uniform(0.001, 2.5), 6)
    fee = round(random.uniform(0.00005, 0.0005), 6)
    change = round(max(0.0001, amount * random.uniform(0.01, 0.15)), 6)
    main_out = round(amount - change, 6)

    return {
        "timestamp": datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S"),
        "src_ip": random.choice(sender["ips"]),
        "dst_ip": random.choice(receiver["ips"]),
        "src_port": _random_port(),
        "dst_port": 8333,
        "txid": _sha256(f"normal_{idx}_{ts}"),
        "input_addresses": [random.choice(sender["addresses"])],
        "output_addresses": [random.choice(receiver["addresses"]), random.choice(sender["addresses"])],
        "input_amounts": [round(amount + fee, 6)],
        "output_amounts": [main_out, change],
        "fee": fee,
        "input_count": 1,
        "output_count": 2,
        "geo_country": sender["geo"]["country"],
        "asn": sender["geo"]["asn"],
        "script_type": random.choice(["P2WPKH", "P2TR", "P2PKH"]),
        "pattern": "normal",
        "entity_id": sender["entity_id"],
        "is_illicit": False,
    }


def _gen_peel_chain(entities: List[Dict], ts: float, idx: int, chain_len: int = 5) -> List[Dict[str, Any]]:
    """Generate a peeling chain: single input, two outputs with asymmetric split, repeated."""
    illicit = [e for e in entities if e["archetype"] == EntityArchetype.ILLICIT]
    sender = random.choice(illicit) if illicit else random.choice(entities)
    total = round(random.uniform(5.0, 50.0), 6)
    remaining = total
    txs = []

    for step in range(chain_len):
        peel_amount = round(remaining * random.uniform(0.03, 0.12), 6)
        forwarded = round(remaining - peel_amount - 0.0001, 6)
        if forwarded <= 0.001:
            break

        hop_addr = _random_btc_address(seed=f"peel_{idx}_{step}_hop")
        peel_addr = _random_btc_address(seed=f"peel_{idx}_{step}_peel")

        tx = {
            "timestamp": datetime.utcfromtimestamp(ts + step * random.randint(30, 300)).strftime("%Y-%m-%d %H:%M:%S"),
            "src_ip": random.choice(sender["ips"]),
            "dst_ip": _random_ip(),
            "src_port": _random_port(),
            "dst_port": 8333,
            "txid": _sha256(f"peel_{idx}_{step}_{ts}"),
            "input_addresses": [random.choice(sender["addresses"]) if step == 0 else txs[-1]["output_addresses"][0]],
            "output_addresses": [hop_addr, peel_addr],
            "input_amounts": [remaining],
            "output_amounts": [forwarded, peel_amount],
            "fee": 0.0001,
            "input_count": 1,
            "output_count": 2,
            "geo_country": sender["geo"]["country"],
            "asn": sender["geo"]["asn"],
            "script_type": "P2WPKH",
            "pattern": "peel_chain",
            "entity_id": sender["entity_id"],
            "is_illicit": True,
        }
        txs.append(tx)
        remaining = forwarded

    return txs


def _gen_coinjoin(entities: List[Dict], ts: float, idx: int) -> Dict[str, Any]:
    """Generate a CoinJoin-like transaction: many inputs, many equal-value outputs."""
    n_participants = random.randint(5, 15)
    equal_amount = round(random.choice([0.01, 0.05, 0.1, 0.5, 1.0]), 6)
    fee_per = round(random.uniform(0.00005, 0.0002), 6)

    input_addrs = []
    output_addrs = []
    input_amounts = []
    output_amounts = []
    ips_used = set()

    for p in range(n_participants):
        e = random.choice(entities)
        input_addrs.append(random.choice(e["addresses"]))
        output_addrs.append(_random_btc_address(seed=f"cj_{idx}_{p}_out"))
        input_amounts.append(round(equal_amount + fee_per, 6))
        output_amounts.append(equal_amount)
        ips_used.add(random.choice(e["ips"]))

    # Add change outputs for some participants
    n_change = random.randint(2, n_participants // 2)
    for c in range(n_change):
        change_addr = _random_btc_address(seed=f"cj_{idx}_{c}_change")
        output_addrs.append(change_addr)
        output_amounts.append(round(random.uniform(0.001, 0.01), 6))

    illicit_entities = [e for e in entities if e["archetype"] == EntityArchetype.ILLICIT]
    suspicious = random.choice(illicit_entities) if illicit_entities else random.choice(entities)

    return {
        "timestamp": datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S"),
        "src_ip": random.choice(list(ips_used)) if ips_used else _random_ip(),
        "dst_ip": _random_ip(),
        "src_port": _random_port(),
        "dst_port": 8333,
        "txid": _sha256(f"coinjoin_{idx}_{ts}"),
        "input_addresses": input_addrs,
        "output_addresses": output_addrs,
        "input_amounts": input_amounts,
        "output_amounts": output_amounts,
        "fee": round(fee_per * n_participants, 6),
        "input_count": n_participants,
        "output_count": len(output_addrs),
        "geo_country": suspicious["geo"]["country"],
        "asn": suspicious["geo"]["asn"],
        "script_type": "P2WSH",
        "pattern": "coinjoin",
        "entity_id": suspicious["entity_id"],
        "is_illicit": True,
    }


def _gen_fan_in(entities: List[Dict], ts: float, idx: int) -> Dict[str, Any]:
    """Fan-in consolidation: many inputs to 1-2 outputs."""
    n_inputs = random.randint(5, 20)
    suspicious = random.choice([e for e in entities if e["archetype"] in (EntityArchetype.SUSPICIOUS, EntityArchetype.ILLICIT)] or entities)
    amounts = [round(random.uniform(0.01, 1.0), 6) for _ in range(n_inputs)]
    total = sum(amounts)
    fee = round(random.uniform(0.0001, 0.001), 6)

    return {
        "timestamp": datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S"),
        "src_ip": random.choice(suspicious["ips"]),
        "dst_ip": _random_ip(),
        "src_port": _random_port(),
        "dst_port": 8333,
        "txid": _sha256(f"fanin_{idx}_{ts}"),
        "input_addresses": [_random_btc_address(seed=f"fanin_{idx}_{j}") for j in range(n_inputs)],
        "output_addresses": [random.choice(suspicious["addresses"])],
        "input_amounts": amounts,
        "output_amounts": [round(total - fee, 6)],
        "fee": fee,
        "input_count": n_inputs,
        "output_count": 1,
        "geo_country": suspicious["geo"]["country"],
        "asn": suspicious["geo"]["asn"],
        "script_type": "P2SH",
        "pattern": "fan_in",
        "entity_id": suspicious["entity_id"],
        "is_illicit": suspicious["archetype"] == EntityArchetype.ILLICIT,
    }


def _gen_fan_out(entities: List[Dict], ts: float, idx: int) -> Dict[str, Any]:
    """Fan-out dispersion: 1-2 inputs to many outputs."""
    n_outputs = random.randint(8, 25)
    suspicious = random.choice([e for e in entities if e["archetype"] in (EntityArchetype.SUSPICIOUS, EntityArchetype.ILLICIT)] or entities)
    total_in = round(random.uniform(2.0, 20.0), 6)
    fee = round(random.uniform(0.0001, 0.001), 6)
    remaining = total_in - fee
    amounts_out = []
    for o in range(n_outputs - 1):
        a = round(remaining / (n_outputs - o) * random.uniform(0.5, 1.5), 6)
        a = min(a, remaining - 0.0001 * (n_outputs - o - 1))
        amounts_out.append(max(0.00001, a))
        remaining -= a
    amounts_out.append(round(max(0.00001, remaining), 6))

    return {
        "timestamp": datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S"),
        "src_ip": random.choice(suspicious["ips"]),
        "dst_ip": _random_ip(),
        "src_port": _random_port(),
        "dst_port": 8333,
        "txid": _sha256(f"fanout_{idx}_{ts}"),
        "input_addresses": [random.choice(suspicious["addresses"])],
        "output_addresses": [_random_btc_address(seed=f"fanout_{idx}_{j}") for j in range(n_outputs)],
        "input_amounts": [total_in],
        "output_amounts": amounts_out,
        "fee": fee,
        "input_count": 1,
        "output_count": n_outputs,
        "geo_country": suspicious["geo"]["country"],
        "asn": suspicious["geo"]["asn"],
        "script_type": "P2WPKH",
        "pattern": "fan_out",
        "entity_id": suspicious["entity_id"],
        "is_illicit": suspicious["archetype"] == EntityArchetype.ILLICIT,
    }


def _gen_rapid_forward(entities: List[Dict], ts: float, idx: int) -> Dict[str, Any]:
    """Rapid forwarding: small time gap pass-through with near-zero fee."""
    suspicious = random.choice([e for e in entities if e["archetype"] != EntityArchetype.NORMAL] or entities)
    amount = round(random.uniform(0.5, 10.0), 6)
    fee = round(random.uniform(0.00005, 0.0001), 6)

    return {
        "timestamp": datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S"),
        "src_ip": random.choice(suspicious["ips"]),
        "dst_ip": _random_ip(),
        "src_port": _random_port(),
        "dst_port": 8333,
        "txid": _sha256(f"rapid_{idx}_{ts}"),
        "input_addresses": [random.choice(suspicious["addresses"])],
        "output_addresses": [_random_btc_address(seed=f"rapid_{idx}_out")],
        "input_amounts": [round(amount + fee, 6)],
        "output_amounts": [amount],
        "fee": fee,
        "input_count": 1,
        "output_count": 1,
        "geo_country": suspicious["geo"]["country"],
        "asn": suspicious["geo"]["asn"],
        "script_type": "P2WPKH",
        "pattern": "rapid_forwarding",
        "entity_id": suspicious["entity_id"],
        "is_illicit": suspicious["archetype"] == EntityArchetype.ILLICIT,
    }


# ---------------------------------------------------------------------------
# Main Generator
# ---------------------------------------------------------------------------

def generate_dataset(
    n_transactions: int = 5000,
    output_dir: str = ".",
    formats: List[str] = None,
    seed: int = 42,
) -> Dict[str, str]:
    """
    Generate the complete synthetic Bitcoin dataset.
    Returns dict of {format: filepath}.
    """
    if formats is None:
        formats = ["csv", "json"]

    random.seed(seed)
    print(f"🔧 Generating {n_transactions} synthetic Bitcoin transactions...")

    entities = _create_entity_pool(n_entities=60)
    print(f"   Created {len(entities)} entities "
          f"({sum(1 for e in entities if e['archetype']=='normal')} normal, "
          f"{sum(1 for e in entities if e['archetype']=='suspicious')} suspicious, "
          f"{sum(1 for e in entities if e['archetype']=='illicit')} illicit)")

    # Time range: 30 days
    base_ts = time.time() - 30 * 86400
    transactions: List[Dict[str, Any]] = []

    # Distribution: 55% normal, 12% peel chains, 10% CoinJoin, 8% fan-in, 8% fan-out, 7% rapid forwarding
    patterns = {
        "normal":           int(n_transactions * 0.55),
        "peel_chain":       int(n_transactions * 0.12),
        "coinjoin":         int(n_transactions * 0.10),
        "fan_in":           int(n_transactions * 0.08),
        "fan_out":          int(n_transactions * 0.08),
        "rapid_forwarding": int(n_transactions * 0.07),
    }

    idx = 0

    # Normal transactions
    for _ in range(patterns["normal"]):
        ts = base_ts + random.uniform(0, 30 * 86400)
        transactions.append(_gen_normal_tx(entities, ts, idx))
        idx += 1

    # Peel chains (each produces multiple txs)
    peel_count = 0
    while peel_count < patterns["peel_chain"]:
        ts = base_ts + random.uniform(0, 30 * 86400)
        chain = _gen_peel_chain(entities, ts, idx, chain_len=random.randint(3, 8))
        transactions.extend(chain)
        peel_count += len(chain)
        idx += 1

    # CoinJoin transactions
    for _ in range(patterns["coinjoin"]):
        ts = base_ts + random.uniform(0, 30 * 86400)
        transactions.append(_gen_coinjoin(entities, ts, idx))
        idx += 1

    # Fan-in
    for _ in range(patterns["fan_in"]):
        ts = base_ts + random.uniform(0, 30 * 86400)
        transactions.append(_gen_fan_in(entities, ts, idx))
        idx += 1

    # Fan-out
    for _ in range(patterns["fan_out"]):
        ts = base_ts + random.uniform(0, 30 * 86400)
        transactions.append(_gen_fan_out(entities, ts, idx))
        idx += 1

    # Rapid forwarding
    for _ in range(patterns["rapid_forwarding"]):
        ts = base_ts + random.uniform(0, 30 * 86400)
        transactions.append(_gen_rapid_forward(entities, ts, idx))
        idx += 1

    # Sort by timestamp
    transactions.sort(key=lambda t: t["timestamp"])

    print(f"   Generated {len(transactions)} total transactions")
    pattern_counts = {}
    for tx in transactions:
        p = tx.get("pattern", "unknown")
        pattern_counts[p] = pattern_counts.get(p, 0) + 1
    for p, c in sorted(pattern_counts.items()):
        print(f"   {p}: {c} transactions")

    illicit_count = sum(1 for tx in transactions if tx.get("is_illicit"))
    print(f"   Illicit-flagged: {illicit_count} ({100*illicit_count/len(transactions):.1f}%)")

    # Write outputs
    os.makedirs(output_dir, exist_ok=True)
    output_files = {}

    # Flatten list fields for CSV
    def _flatten(tx: Dict) -> Dict:
        flat = dict(tx)
        for key in ["input_addresses", "output_addresses", "input_amounts", "output_amounts"]:
            if isinstance(flat.get(key), list):
                flat[key] = ";".join(str(v) for v in flat[key])
        return flat

    if "csv" in formats:
        csv_path = os.path.join(output_dir, "bitcoin_dataset.csv")
        fieldnames = [
            "timestamp", "src_ip", "dst_ip", "src_port", "dst_port",
            "txid", "input_addresses", "output_addresses",
            "input_amounts", "output_amounts",
            "fee", "input_count", "output_count",
            "geo_country", "asn", "script_type",
            "pattern", "entity_id", "is_illicit"
        ]
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            for tx in transactions:
                writer.writerow(_flatten(tx))
        output_files["csv"] = csv_path
        print(f"   📄 CSV: {csv_path}")

    if "json" in formats:
        json_path = os.path.join(output_dir, "bitcoin_dataset.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump({"transactions": transactions, "entities": entities}, f, indent=2)
        output_files["json"] = json_path
        print(f"   📄 JSON: {json_path}")

    if "xml" in formats:
        xml_path = os.path.join(output_dir, "bitcoin_dataset.xml")
        with open(xml_path, "w", encoding="utf-8") as f:
            f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
            f.write("<bitcoin_dataset>\n")
            f.write("  <transactions>\n")
            for tx in transactions:
                f.write("    <transaction>\n")
                for k, v in tx.items():
                    if isinstance(v, list):
                        f.write(f"      <{k}>\n")
                        for item in v:
                            f.write(f"        <item>{item}</item>\n")
                        f.write(f"      </{k}>\n")
                    elif isinstance(v, bool):
                        f.write(f"      <{k}>{'true' if v else 'false'}</{k}>\n")
                    else:
                        f.write(f"      <{k}>{v}</{k}>\n")
                f.write("    </transaction>\n")
            f.write("  </transactions>\n")
            f.write("</bitcoin_dataset>\n")
        output_files["xml"] = xml_path
        print(f"   📄 XML: {xml_path}")

    # Also save entity manifest (for risk propagation seeding)
    entity_path = os.path.join(output_dir, "entity_manifest.json")
    with open(entity_path, "w", encoding="utf-8") as f:
        json.dump(entities, f, indent=2)
    print(f"   📄 Entity manifest: {entity_path}")

    print(f"✅ Dataset generation complete!")
    return output_files


# ---------------------------------------------------------------------------
# CLI Entry Point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="V.E.C.T.O.R Bitcoin Synthetic Dataset Generator")
    parser.add_argument("--count", type=int, default=5000, help="Number of transactions (default: 5000)")
    parser.add_argument("--output", type=str, default=".", help="Output directory")
    parser.add_argument("--formats", nargs="+", default=["csv", "json", "xml"], help="Output formats")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    args = parser.parse_args()

    generate_dataset(
        n_transactions=args.count,
        output_dir=args.output,
        formats=args.formats,
        seed=args.seed,
    )
