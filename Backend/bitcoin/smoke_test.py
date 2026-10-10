"""Quick smoke test for all new V.E.C.T.O.R-BITCOIN components."""
import sys
sys.path.insert(0, '.')

from bitcoin.generate_dataset import generate_dataset
from bitcoin.ip_correlator import IPWalletCorrelator, lookup_geoip, is_tor_exit
from bitcoin.risk_propagation import RiskPropagationEngine
from bitcoin.bitcoin_rules import BitcoinRulesEngine

print('All new modules import successfully')

# Quick smoke test
geo = lookup_geoip('10.255.1.1')
print(f'GeoIP test: {geo}')
assert geo['country'] == 'XX', 'Tor detection failed'
assert is_tor_exit('10.255.1.1'), 'Tor exit check failed'
print('GeoIP + Tor detection working')

# Test risk propagation
rp = RiskPropagationEngine()
rp.add_edge('A', 'B')
rp.add_edge('B', 'C')
rp.add_edge('C', 'D')
rp.seed_illicit('A', 1.0)
rp.propagate()
print(f'Propagated risks: A={rp.get_risk_score("A"):.2f}, B={rp.get_risk_score("B"):.2f}, C={rp.get_risk_score("C"):.2f}, D={rp.get_risk_score("D"):.2f}')
assert rp.get_risk_score('A') == 1.0
assert rp.get_risk_score('B') > rp.get_risk_score('C')
print('Risk propagation working with decay')

# Test CoinJoin detection
tx = {
    'input_count': 8, 'output_count': 10, 'total_output_btc': 4.0,
    'outputs': [{'value_btc': 0.5, 'is_op_return': False}] * 8 + [{'value_btc': 0.01, 'is_op_return': False}] * 2,
    'src_ip': '10.255.1.5'
}
result = BitcoinRulesEngine.evaluate_heuristics(tx)
print(f'CoinJoin test: is_coinjoin={result["is_coinjoin"]}, signals={result["signals"]}')
assert result['is_coinjoin'], 'CoinJoin detection failed'
assert 'tor_exit_node' in result['signals'], 'Tor detection in rules failed'
print('CoinJoin + Tor rules working')

# Test IP correlator
corr = IPWalletCorrelator()
corr.record_observation('10.255.1.1', '34.1.2.3', 'tx001', '2024-01-01 12:00:00',
                        ['bc1qtest1'], ['bc1qtest2'], 'ENT_001', 'XX', 1.5)
corr.record_observation('10.255.1.1', '54.1.2.3', 'tx002', '2024-01-01 12:01:00',
                        ['bc1qtest3'], ['bc1qtest4'], 'ENT_002', 'XX', 2.0)
links = corr.find_cross_entity_ip_links()
print(f'Cross-entity IP links: {len(links)}')
assert len(links) > 0, 'Cross-entity link detection failed'
print('IP correlation working')

print()
print('ALL COMPONENT SMOKE TESTS PASSED!')
