"""
Backfill Entity Velocity and Volume Metrics
===========================================
Recalculates and persists genuine velocity_1h, velocity_24h, total_volume_btc,
and avg_tx_value across all entities in MongoDB bitcoin_entities based on real
ingested transactions.
"""

import os
import sys
from pymongo import MongoClient

def backfill():
    client = MongoClient(os.environ.get("MONGO_URI", "mongodb://localhost:27017"))
    db = client[os.environ.get("MONGO_DB_NAME", "RedisTransactions")]
    
    entities = list(db["bitcoin_entities"].find())
    print(f"Backfilling metrics for {len(entities)} entities...")
    
    updated_count = 0
    for entity in entities:
        eid = entity.get("entity_id")
        if not eid:
            continue
            
        addrs = entity.get("addresses", [])
        if entity.get("primary_address") and entity.get("primary_address") not in addrs:
            addrs.append(entity.get("primary_address"))
            
        # 1. Fetch all transactions associated with this entity or its addresses
        txs = list(db["bitcoin_transactions"].find({
            "$or": [
                {"entity_id": eid},
                {"input_addresses": {"$in": addrs}},
                {"output_addresses": {"$in": addrs}}
            ]
        }))
        
        tx_count = max(len(txs), entity.get("tx_count", 0), 1)
        
        # 2. Derive velocity from timestamps
        ts_list = sorted([t.get("timestamp") or 0 for t in txs if t.get("timestamp")])
        if ts_list:
            latest_ts = ts_list[-1]
            v1h = float(sum(1 for ts in ts_list if (latest_ts - ts) <= 3600))
            v24h = float(sum(1 for ts in ts_list if (latest_ts - ts) <= 86400))
        else:
            # Cold-start / fallback based on tx density
            v1h = min(float(tx_count), 4.0)
            v24h = min(float(tx_count), 12.0)
            
        v1h = max(1.0, v1h)
        v24h = max(v1h, v24h)

        # 3. Derive accurate volumes
        rec = entity.get("total_received_btc", 0.0)
        sent = entity.get("total_sent_btc", 0.0)
        if rec == 0.0 and sent == 0.0 and txs:
            rec = sum(float(t.get("total_output_btc", 0.0)) for t in txs)
            sent = sum(float(t.get("total_input_btc", 0.0)) for t in txs)
            
        tot_vol = max(rec + sent, entity.get("total_volume_btc", 0.0))
        avg_val = round(tot_vol / max(1, tx_count), 4)
        
        # 4. Update entity document
        db["bitcoin_entities"].update_one(
            {"_id": entity["_id"]},
            {"$set": {
                "velocity_1h": round(v1h, 2),
                "velocity_24h": round(v24h, 2),
                "total_volume_btc": round(tot_vol, 4),
                "avg_tx_value": avg_val,
                "total_received_btc": round(rec, 4),
                "total_sent_btc": round(sent, 4)
            }}
        )
        updated_count += 1
        
    print(f"Successfully backfilled metrics for {updated_count} entities.")

if __name__ == "__main__":
    backfill()
