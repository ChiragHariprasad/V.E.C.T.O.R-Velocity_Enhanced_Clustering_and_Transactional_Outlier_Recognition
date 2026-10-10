"""
Bitcoin Entity Profiler & Clustering Manager
Groups addresses into behavioral entities using multi-input heuristics (common-input clustering),
maintaining entity profiles while preserving the scientific distinction that an entity is a
behavioral grouping rather than proven legal identity.
"""

from typing import Dict, Any, List, Set
import hashlib

class EntityProfiler:
    def __init__(self):
        # address -> entity_id
        self._address_to_entity: Dict[str, str] = {}
        # entity_id -> set of addresses
        self._entity_addresses: Dict[str, Set[str]] = {}
        # entity_id -> profile metrics
        self._entity_profiles: Dict[str, Dict[str, Any]] = {}

    def get_or_create_entity(self, input_addresses: List[str], primary_address: str) -> str:
        """
        Group input addresses via common-input heuristic.
        If any input address belongs to an entity, merge them.
        """
        existing_entities = set()
        for addr in input_addresses:
            if addr in self._address_to_entity:
                existing_entities.add(self._address_to_entity[addr])

        if not existing_entities:
            # Create new entity ID
            entity_id = f"ENT_{hashlib.sha256(primary_address.encode()).hexdigest()[:12].upper()}"
        else:
            # Pick first and merge others
            entity_id = sorted(list(existing_entities))[0]

        # Associate all inputs with this entity
        if entity_id not in self._entity_addresses:
            self._entity_addresses[entity_id] = set()

        for addr in input_addresses:
            self._address_to_entity[addr] = entity_id
            self._entity_addresses[entity_id].add(addr)

        if primary_address:
            self._address_to_entity[primary_address] = entity_id
            self._entity_addresses[entity_id].add(primary_address)

        if entity_id not in self._entity_profiles:
            self._entity_profiles[entity_id] = {
                "entity_id": entity_id,
                "first_seen": None,
                "last_seen": None,
                "tx_count": 0,
                "total_received_btc": 0.0,
                "total_sent_btc": 0.0,
                "unique_counterparties": set(),
                "cluster_id": None,
                "risk_score": 0.0,
                "risk_level": "LOW"
            }

        return entity_id

    def get_entity_for_address(self, address: str) -> str:
        """Retrieve or derive behavioral entity for an address."""
        if address in self._address_to_entity:
            return self._address_to_entity[address]
        entity_id = f"ENT_{hashlib.sha256(address.encode()).hexdigest()[:12].upper()}"
        self._address_to_entity[address] = entity_id
        if entity_id not in self._entity_addresses:
            self._entity_addresses[entity_id] = set()
        self._entity_addresses[entity_id].add(address)
        return entity_id

    def get_entity_addresses(self, entity_id: str) -> List[str]:
        return list(self._entity_addresses.get(entity_id, []))
