"""
V.E.C.T.O.R-BITCOIN IP-Wallet Correlation Engine
Tracks and analyzes the correlation between network-layer (IP/port/timing)
and blockchain-layer (wallet/TXID/amount) observations.

Computes IP-based investigative features:
  - IP reuse across entities
  - Geographic diversity per entity
  - Tor/VPN exit node detection
  - IP-timing patterns (burst from single IP)
  - Cross-entity IP sharing (linkage signal)
"""

from typing import Dict, Any, List, Set, Tuple, Optional
from collections import defaultdict
from datetime import datetime
import math

# Bundled GeoIP lookup — same table as generate_dataset.py
GEOIP_TABLE = {
    "34.":      {"country": "US", "asn": "AS15169", "label": "Google LLC"},
    "54.":      {"country": "US", "asn": "AS16509", "label": "Amazon AWS"},
    "52.":      {"country": "US", "asn": "AS14618", "label": "Amazon East"},
    "95.216.":  {"country": "DE", "asn": "AS24940", "label": "Hetzner Online"},
    "178.162.": {"country": "NL", "asn": "AS60781", "label": "LeaseWeb NL"},
    "185.22.":  {"country": "RU", "asn": "AS49505", "label": "Selectel RU"},
    "119.29.":  {"country": "CN", "asn": "AS45090", "label": "Shenzhen Tencent"},
    "13.250.":  {"country": "SG", "asn": "AS16509", "label": "AWS Singapore"},
    "45.63.":   {"country": "GB", "asn": "AS20473", "label": "Vultr London"},
    "163.44.":  {"country": "JP", "asn": "AS2519",  "label": "ARTERIA Networks"},
    "185.56.":  {"country": "RO", "asn": "AS9009",  "label": "M247 Ltd"},
    "179.43.":  {"country": "CH", "asn": "AS51852", "label": "Private Layer"},
    "91.236.":  {"country": "UA", "asn": "AS28907", "label": "MIROHOST"},
    "189.1.":   {"country": "BR", "asn": "AS28573", "label": "Claro SA"},
    "49.36.":   {"country": "IN", "asn": "AS55836", "label": "Reliance Jio"},
    "151.101.": {"country": "CA", "asn": "AS54113", "label": "Fastly"},
    "51.77.":   {"country": "FR", "asn": "AS16276", "label": "OVH SAS"},
    "203.29.":  {"country": "AU", "asn": "AS7545",  "label": "TPG Telecom"},
    "175.45.":  {"country": "KR", "asn": "AS4766",  "label": "Korea Telecom"},
    "197.210.": {"country": "NG", "asn": "AS37148", "label": "Spectranet"},
    "10.255.":  {"country": "XX", "asn": "AS0",     "label": "Tor Exit Node"},
    "10.254.":  {"country": "XX", "asn": "AS0",     "label": "Tor Exit Node"},
}

# Known Tor exit / VPN indicators
TOR_PREFIXES = ["10.255.", "10.254."]
VPN_ASNS = {"AS9009", "AS51852", "AS60781"}


def lookup_geoip(ip: str) -> Dict[str, str]:
    """Lookup GeoIP info for an IP using bundled prefix table."""
    for prefix, info in GEOIP_TABLE.items():
        if ip.startswith(prefix):
            return dict(info)
    # Fallback for unknown IPs
    return {"country": "UNKNOWN", "asn": "AS0", "label": "Unknown ISP"}


def is_tor_exit(ip: str) -> bool:
    """Check if IP is a known Tor exit node."""
    return any(ip.startswith(p) for p in TOR_PREFIXES)


def is_vpn_likely(ip: str) -> bool:
    """Check if IP belongs to a known VPN/hosting ASN."""
    geo = lookup_geoip(ip)
    return geo["asn"] in VPN_ASNS


class IPWalletCorrelator:
    """
    Maintains and queries the IP ↔ Wallet ↔ Transaction correlation index.
    """

    def __init__(self):
        # ip -> set of wallet addresses seen using this IP
        self._ip_to_wallets: Dict[str, Set[str]] = defaultdict(set)
        # wallet -> set of IPs that relayed transactions for this wallet
        self._wallet_to_ips: Dict[str, Set[str]] = defaultdict(set)
        # ip -> list of (timestamp, txid) observations
        self._ip_observations: Dict[str, List[Tuple[str, str]]] = defaultdict(list)
        # entity -> set of IPs associated
        self._entity_to_ips: Dict[str, Set[str]] = defaultdict(set)
        # ip -> set of entity_ids
        self._ip_to_entities: Dict[str, Set[str]] = defaultdict(set)
        # ip -> set of countries (for geo-diversity tracking)
        self._entity_countries: Dict[str, Set[str]] = defaultdict(set)
        # geo_country -> transaction count
        self._country_tx_count: Dict[str, int] = defaultdict(int)
        # geo_country -> total BTC volume
        self._country_btc_volume: Dict[str, float] = defaultdict(float)

    def record_observation(
        self,
        src_ip: str,
        dst_ip: str,
        txid: str,
        timestamp: str,
        input_addresses: List[str],
        output_addresses: List[str],
        entity_id: Optional[str] = None,
        geo_country: Optional[str] = None,
        total_btc: float = 0.0,
    ):
        """Record a single network-layer observation tied to a blockchain transaction."""
        all_addrs = list(set(input_addresses + output_addresses))

        # IP → wallet mappings
        for addr in all_addrs:
            self._ip_to_wallets[src_ip].add(addr)
            self._wallet_to_ips[addr].add(src_ip)

        # IP timing observations
        self._ip_observations[src_ip].append((timestamp, txid))

        # Entity → IP
        if entity_id:
            self._entity_to_ips[entity_id].add(src_ip)
            self._entity_to_ips[entity_id].add(dst_ip)
            self._ip_to_entities[src_ip].add(entity_id)
            self._ip_to_entities[dst_ip].add(entity_id)

            # Entity geographic diversity
            geo = lookup_geoip(src_ip)
            self._entity_countries[entity_id].add(geo["country"])

        # Country statistics
        country = geo_country or lookup_geoip(src_ip)["country"]
        self._country_tx_count[country] += 1
        self._country_btc_volume[country] += total_btc

    def get_ip_features(self, ip: str) -> Dict[str, Any]:
        """Extract investigative features for an IP address."""
        wallets = self._ip_to_wallets.get(ip, set())
        entities = self._ip_to_entities.get(ip, set())
        observations = self._ip_observations.get(ip, [])
        geo = lookup_geoip(ip)

        # Timing analysis
        burst_score = 0.0
        if len(observations) > 1:
            timestamps = []
            for ts_str, _ in observations:
                try:
                    timestamps.append(datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S").timestamp())
                except (ValueError, TypeError):
                    pass
            if len(timestamps) > 1:
                timestamps.sort()
                intervals = [timestamps[i] - timestamps[i-1] for i in range(1, len(timestamps))]
                min_interval = min(intervals) if intervals else 3600
                burst_score = min(1.0, 60.0 / max(1.0, min_interval))  # High score if intervals < 60s

        return {
            "ip": ip,
            "wallet_count": len(wallets),
            "entity_count": len(entities),
            "observation_count": len(observations),
            "is_tor": is_tor_exit(ip),
            "is_vpn": is_vpn_likely(ip),
            "country": geo["country"],
            "asn": geo["asn"],
            "isp_label": geo["label"],
            "burst_score": round(burst_score, 4),
            "entities": list(entities),
            "wallets_sample": list(wallets)[:10],  # First 10 for display
        }

    def get_wallet_features(self, address: str) -> Dict[str, Any]:
        """Extract IP correlation features for a wallet address."""
        ips = self._wallet_to_ips.get(address, set())
        countries = set()
        tor_count = 0
        vpn_count = 0

        for ip in ips:
            geo = lookup_geoip(ip)
            countries.add(geo["country"])
            if is_tor_exit(ip):
                tor_count += 1
            if is_vpn_likely(ip):
                vpn_count += 1

        return {
            "address": address,
            "unique_ip_count": len(ips),
            "geo_diversity": len(countries),
            "countries": list(countries),
            "tor_ip_count": tor_count,
            "vpn_ip_count": vpn_count,
            "tor_ratio": round(tor_count / max(1, len(ips)), 4),
            "vpn_ratio": round(vpn_count / max(1, len(ips)), 4),
            "anonymity_score": round(min(1.0, (tor_count + vpn_count) / max(1, len(ips))), 4),
        }

    def get_entity_ip_profile(self, entity_id: str) -> Dict[str, Any]:
        """Get network-layer profile for a behavioral entity."""
        ips = self._entity_to_ips.get(entity_id, set())
        countries = self._entity_countries.get(entity_id, set())

        tor_ips = [ip for ip in ips if is_tor_exit(ip)]
        vpn_ips = [ip for ip in ips if is_vpn_likely(ip)]

        # Cross-entity linkage: other entities sharing IPs
        linked_entities = set()
        for ip in ips:
            linked_entities.update(self._ip_to_entities.get(ip, set()))
        linked_entities.discard(entity_id)

        return {
            "entity_id": entity_id,
            "unique_ips": len(ips),
            "geo_countries": list(countries),
            "geo_diversity_score": min(1.0, len(countries) / 5.0),  # Normalize to 5 countries
            "tor_ip_count": len(tor_ips),
            "vpn_ip_count": len(vpn_ips),
            "anonymity_score": round(min(1.0, (len(tor_ips) + len(vpn_ips)) / max(1, len(ips))), 4),
            "cross_entity_links": list(linked_entities),
            "cross_entity_link_count": len(linked_entities),
            "ip_list": list(ips)[:20],
        }

    def find_cross_entity_ip_links(self) -> List[Dict[str, Any]]:
        """Find IPs shared across multiple entities (linkage/infrastructure reuse signal)."""
        links = []
        for ip, entities in self._ip_to_entities.items():
            if len(entities) > 1:
                geo = lookup_geoip(ip)
                links.append({
                    "ip": ip,
                    "entity_count": len(entities),
                    "entities": list(entities),
                    "country": geo["country"],
                    "asn": geo["asn"],
                    "is_tor": is_tor_exit(ip),
                    "is_vpn": is_vpn_likely(ip),
                })
        links.sort(key=lambda x: x["entity_count"], reverse=True)
        return links

    def get_geo_stats(self) -> List[Dict[str, Any]]:
        """Get geographic distribution of transactions for heatmap visualization."""
        stats = []
        for country in set(list(self._country_tx_count.keys()) + list(self._country_btc_volume.keys())):
            stats.append({
                "country": country,
                "tx_count": self._country_tx_count.get(country, 0),
                "btc_volume": round(self._country_btc_volume.get(country, 0.0), 4),
            })
        stats.sort(key=lambda x: x["tx_count"], reverse=True)
        return stats

    def get_correlation_summary(self) -> Dict[str, Any]:
        """Get overall correlation statistics."""
        total_ips = len(self._ip_to_wallets)
        total_wallets = len(self._wallet_to_ips)
        total_entities = len(self._entity_to_ips)
        tor_ips = sum(1 for ip in self._ip_to_wallets if is_tor_exit(ip))
        vpn_ips = sum(1 for ip in self._ip_to_wallets if is_vpn_likely(ip))
        cross_links = self.find_cross_entity_ip_links()

        return {
            "total_unique_ips": total_ips,
            "total_tracked_wallets": total_wallets,
            "total_entities": total_entities,
            "tor_ip_count": tor_ips,
            "vpn_ip_count": vpn_ips,
            "cross_entity_ip_links": len(cross_links),
            "top_shared_ips": cross_links[:5],
            "geo_distribution": self.get_geo_stats(),
        }
