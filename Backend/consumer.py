import redis
import ast
import time
import joblib
import os
import numpy as np
import pymongo
import secrets
from datetime import datetime, timedelta
from trigger import generate_user_cluster_hashmap
from sklearn.preprocessing import StandardScaler
from collections import defaultdict
from common_constants import (
    FEATURE_KEYS,
    MERCHANT_MAP,
    DEVICE_MAP,
    PAYMENT_METHOD_MAP,
    NUM_FEATURES,
    ANOMALY_THRESHOLD,
    build_feature_array,
    validate_feature_vector
)

# ========== MongoDB Setup ==========
mongo_client = pymongo.MongoClient("mongodb://localhost:27017/")
db = mongo_client["RedisTransactions"]
fraud_collection = db["fraud_transactions"]
legit_collection = db["legit_transactions"]
fraud_counter = fraud_collection.estimated_document_count()

# ========== Redis Setup ==========
r = redis.Redis(host='localhost', port=6379, decode_responses=True)
last_ids = {
    "csv_to_producer": '0-0',
    "custom_input_stream": '0-0'
}

import json
# ========== Trigger & Cluster Load ==========
if os.path.exists("user_cluster_mapping.json"):
    with open("user_cluster_mapping.json", "r") as f:
        user_cluster_map = json.load(f)
    print(f"✅ Fast-loaded cluster mapping for {len(user_cluster_map)} users from user_cluster_mapping.json")
else:
    print("🔁 Triggering cluster re-training for logging...")
    user_cluster_map = generate_user_cluster_hashmap()
    print(f"✅ Cluster mapping loaded for {len(user_cluster_map)} users.")

# ========== Fallback Model ==========
try:
    fallback_model = joblib.load("cluster_models/fallback_xgboost_model.joblib")
    fallback_scaler = joblib.load("cluster_models/fallback_scaler.joblib")  # assuming you saved a scaler too
    print("✅ Loaded fallback XGBoost model and scaler")
except FileNotFoundError:
    print("❌ Fallback model or scaler not found.")
    fallback_model = None

# ========== Suspicion Buffers ==========
suspicion_buffers = defaultdict(list)

# ========== Dynamic Feature Extraction with Sensible Defaults ==========
def compute_dynamic_features(user_id, amount, date_str, time_str):
    """Compute dynamic features for a transaction, with fallbacks for new users"""
    hash_key = f"user:{user_id}"
    today = date_str
    timestamp = f"{date_str} {time_str}"
    dt = datetime.strptime(timestamp, "%Y-%m-%d %H:%M:%S")

    # FIX #1: Sensible defaults for new users (BUG #1)
    avg_amt_redis = r.hget(hash_key, "Avg_Amount")
    if avg_amt_redis:
        avg_amt = float(avg_amt_redis)
        avg_amt = round((avg_amt + amount) / 2, 2)
    else:
        # NEW USER: Use current amount as baseline
        avg_amt = float(amount)
    
    r.hincrby(f"{hash_key}:tx:{today}", "count", 1)

    yesterday = (dt - timedelta(days=1)).strftime("%Y-%m-%d")
    y_count = int(r.hget(f"{hash_key}:tx:{yesterday}", "count") or 0)
    today_count = int(r.hget(f"{hash_key}:tx:{today}", "count") or 0)
    
    # For new users, use sensible default of 1.0 instead of 0
    if y_count > 0 or today_count > 1:
        tx_per_day = round((today_count + y_count) / 2, 2)
    else:
        tx_per_day = 1.0

    month_key = dt.strftime("%Y-%m")
    r.hincrby(f"{hash_key}:velocity:{month_key}", "count", 1)
    velocity_data = r.hgetall(f"{hash_key}:velocity:{month_key}")
    
    # For new users, use sensible default of 1.0 instead of 0
    if velocity_data:
        monthly_counts = [int(v) for v in velocity_data.values()]
        velocity = round(np.mean(monthly_counts), 2)
    else:
        velocity = 1.0

    large_txn_flag = 1 if amount > 1.5 * avg_amt else 0
    last_large_date = r.hget(hash_key, "Last_Large_Date")
    
    if large_txn_flag:
        if last_large_date:
            last = datetime.strptime(last_large_date, "%Y-%m-%d")
            days_between = (dt - last).days
        else:
            days_between = 30
        r.hset(hash_key, "Last_Large_Date", date_str)
    else:
        days_between = float(r.hget(hash_key, "Large_Transaction_Frequency") or 30.0)

    ltf = round((days_between + float(r.hget(hash_key, "Large_Transaction_Frequency") or 30.0)) / 2, 2)

    return {
        "Avg_Amount": avg_amt,
        "Transactions_Per_Day": tx_per_day,
        "Velocity": velocity,
        "Large_Transaction_Flag": large_txn_flag,
        "Large_Transaction_Frequency": ltf
    }



# ========== Main Listener ==========
print(f"👂 Listening on Redis streams: {list(last_ids.keys())}")

while True:
    try:
        response = r.xread(streams=last_ids, block=0, count=1)
        if response:
            for stream_name, messages in response:
                for msg_id, msg_data in messages:
                    last_ids[stream_name] = msg_id  # ✅ Move to next message

                    print(f"\n🔍 Processing message from {stream_name}: {msg_id}")
                    print(f"🔍 msg_data: {msg_data}")
                    try:
                        if "data" not in msg_data:
                            print("⚠️ Skipping malformed message (no 'data' key)")
                            continue

                        data_str = msg_data["data"]
                        if data_str.startswith("'") and data_str.endswith("'"):
                            data_str = data_str[1:-1]

                        tx = ast.literal_eval(data_str)
                        if not isinstance(tx, dict):
                            print(f"❌ Parsed transaction is not a dictionary")
                            continue

                        user_id = tx.get("User_ID")
                        if not user_id:
                            print("⚠️ Missing User_ID, skipping")
                            continue

                        amount = float(tx.get("Amount", 0.0))
                        session_time = float(tx.get("Session_Time", 0.0))
                        active_loans = int(tx.get("Active_Loans", 0))
                        merchant = tx.get("Merchant_Category", "")
                        device = tx.get("Device_Type", "")
                        date_str = tx.get("Date", "")
                        time_str = tx.get("Time", "")

                        # FIX #1 & #4: Validate merchant and device categories
                        # Map unknown categories to sensible defaults instead of 0 (Luxury Goods)
                        if merchant not in MERCHANT_MAP:
                            print(f"⚠️ Warning: Unknown merchant '{merchant}', mapping to 'Online Services'")
                            merchant = "Online Services"
                        
                        if device not in DEVICE_MAP:
                            print(f"⚠️ Warning: Unknown device '{device}', mapping to 'Mobile'")
                            device = "Mobile"

                        merchant_code = MERCHANT_MAP.get(merchant, MERCHANT_MAP["UNKNOWN"])
                        device_code = DEVICE_MAP.get(device, DEVICE_MAP["UNKNOWN"])

                        features = compute_dynamic_features(user_id, amount, date_str, time_str)

                        # FIX #2: Build feature vector in EXACT FEATURE_KEYS order
                        # This dictionary MUST have every key in FEATURE_KEYS
                        feature_vector = {
                            "Amount": float(amount),
                            "Avg_Amount": features["Avg_Amount"],
                            "Active_Loan_Count": float(active_loans),
                            "Session_Time": float(session_time),
                            "Transactions_Per_Day": features["Transactions_Per_Day"],
                            "Velocity": features["Velocity"],
                            "Large_Transaction_Flag": features["Large_Transaction_Flag"],
                            "Large_Transaction_Frequency": features["Large_Transaction_Frequency"],
                            "Merchant_Type_Code": float(merchant_code),
                            "Device_Type_Code": float(device_code)
                        }

                        # Validate and build feature array (CRITICAL: exact order)
                        try:
                            validate_feature_vector(feature_vector)
                            X = build_feature_array(feature_vector)
                        except ValueError as e:
                            print(f"❌ Feature validation failed: {e}")
                            continue

                        cluster_info = user_cluster_map.get(user_id)
                        cluster = cluster_info["Cluster"] if cluster_info else None
                        if cluster == -1:
                            cluster = None  # treat as unassigned → fallback

                        # ------------------ Model Prediction ------------------
                        fallback_used = False
                        if cluster is not None:
                            try:
                                model_bundle = joblib.load(f"cluster_models/cluster_{cluster}_bundle.pkl")
                                model, scaler, score_min, score_max = model_bundle
                                
                                # FIX #6: Validate score range
                                if np.isnan(score_min) or np.isnan(score_max) or np.isinf(score_min) or np.isinf(score_max):
                                    print(f"⚠️ Warning: Invalid score range for cluster {cluster}")
                                    score_min, score_max = -1.0, 1.0
                                
                                X_scaled = scaler.transform(X)
                                score = model.decision_function(X_scaled)[0]

                                # Normalize using actual training score range
                                if score_max != score_min:
                                    prob = (score - score_min) / (score_max - score_min)
                                    prob = max(0.0, min(1.0, prob))  # Clamp to [0, 1]
                                else:
                                    prob = 0.5
                                pred = 1 if prob > ANOMALY_THRESHOLD else 0

                            except FileNotFoundError:
                                if fallback_model and fallback_scaler:
                                    fallback_used = True
                                    cluster = "Fallback"
                                    # FIX #2: Use EXACT same feature vector as cluster models
                                    X_scaled = fallback_scaler.transform(X)
                                    # Use predict_proba for XGBoost to get probability scores
                                    try:
                                        prob_scores = fallback_model.predict_proba(X_scaled)[0]
                                        # prob_scores = [prob_class_0, prob_class_1]
                                        prob = float(prob_scores[1])  # Probability of class 1 (anomaly)
                                        pred = 1 if prob > ANOMALY_THRESHOLD else 0
                                    except AttributeError:
                                        # Fallback if model doesn't support predict_proba
                                        pred = fallback_model.predict(X_scaled)[0]
                                        prob = float(pred)  # 0 or 1
                                else:
                                    print("⚠️ No model or fallback available.")
                                    pred = None
                                    prob = None

                        elif fallback_model and fallback_scaler:
                            fallback_used = True
                            cluster = "Fallback"
                            # FIX #2: Use EXACT same feature vector (same 10 columns, same order)
                            X_scaled = fallback_scaler.transform(X)
                            # Use predict_proba for XGBoost to get probability scores (anomaly likelihood)
                            try:
                                prob_scores = fallback_model.predict_proba(X_scaled)[0]
                                # prob_scores = [prob_class_0, prob_class_1]
                                prob = float(prob_scores[1])  # Probability of class 1 (anomaly)
                                pred = 1 if prob > ANOMALY_THRESHOLD else 0
                            except AttributeError:
                                # Fallback if model doesn't support predict_proba
                                pred = fallback_model.predict(X_scaled)[0]
                                prob = float(pred)  # 0 or 1 

                        else:
                            print("⚠️ No cluster or fallback model available.")
                            pred = None
                            prob = None

                        # ------------------ Categorization ------------------
                        if fallback_used:
                            if pred == 0:
                                category = "🟩 Legit"
                                suspicion_buffers[user_id].clear()
                            else:
                                category = "🟥 FRAUD"
                                suspicion_buffers[user_id].clear()
                            prob = 1.0 if pred == 1 else 0.0
                        else:
                            if prob <= 0.4:
                                category = "🟩 Legit"
                                suspicion_buffers[user_id].clear()
                            elif prob <= 0.8:
                                suspicion_buffers[user_id].append(prob)
                                buffer_total = sum(suspicion_buffers[user_id])
                                if buffer_total > 0.8:
                                    category = "🟥 FRAUD (Buffered)"
                                    suspicion_buffers[user_id].clear()
                                else:
                                    category = "🟨 Suspicious"
                            else:
                                category = "🟥 FRAUD"
                                suspicion_buffers[user_id].clear()

                        # ------------------ Logging and Persistence ------------------
                        tx.update(feature_vector)
                        tx["fraud_score"] = round(prob, 6)

                        if "FRAUD" in category:
                            tx["fraud_token"] = fraud_counter
                            fraud_collection.insert_one(tx)
                            fraud_counter += 1
                        elif category == "🟩 Legit":
                            tx["legit_token"] = secrets.token_hex(8)
                            legit_collection.insert_one(tx)
                            user_hash_key = f"user:{user_id}"
                            # FIX #5: Store ALL model-required fields in Redis hash
                            # This prevents defaults (0) from being used on next transactions
                            r.hset(user_hash_key, mapping={
                                "Avg_Amount": feature_vector["Avg_Amount"],
                                "Active_Loan_Count": feature_vector["Active_Loan_Count"],
                                "Transactions_Per_Day": feature_vector["Transactions_Per_Day"],
                                "Velocity": feature_vector["Velocity"],
                                "Large_Transaction_Frequency": feature_vector["Large_Transaction_Frequency"],
                                "Large_Transaction_Flag": feature_vector["Large_Transaction_Flag"],
                                "Merchant_Type_Code": feature_vector["Merchant_Type_Code"],
                                "Device_Type_Code": feature_vector["Device_Type_Code"],
                            })
                            r.hincrby(user_hash_key, "Transaction_Count", 1)

                        print(f"\n🚨 Transaction:")
                        print(f"   User ID         : {user_id}")
                        print(f"   Cluster         : {cluster}")
                        print(f"   Amount          : ₹{amount}")
                        print(f"   Fraud Score     : {prob:.4f}")
                        print(f"   Category        : {category}")

                    except Exception as e:
                        print(f"❌ Error processing message: {e}")
                        import traceback
                        traceback.print_exc()

    except KeyboardInterrupt:
        print("\n🛑 Exiting gracefully...")
        break
