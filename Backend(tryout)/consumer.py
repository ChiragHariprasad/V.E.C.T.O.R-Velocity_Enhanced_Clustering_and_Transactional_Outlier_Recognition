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

# ========== Merchant & Device Encoding ==========
MERCHANT_MAP = {
    'Luxury Goods': 0,
    'Travel': 1,
    'Electronics': 2,
    'Apparel': 3,
    'Food Delivery': 4,
    'Online Services': 5,
    'Groceries': 6,
    'Utilities': 7,
    'Medical': 8,
    'Wellness': 9,
    'Organic Grocery': 10,
    'Jewelry': 11,
    'Health': 12,
    'Hygiene Products': 13,
    'Apparel (gifts)': 14,
    'Food': 15,
    'Apparel Deals': 16
}
DEVICE_MAP = {'Mobile': 0, 'PC': 1, 'Tablet': 2}

# ========== Trigger & Cluster Load ==========
print("🔁 Triggering cluster re-training...")
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

# ========== Dynamic Feature Extraction ==========
def compute_dynamic_features(user_id, amount, date_str, time_str):
    hash_key = f"user:{user_id}"
    today = date_str
    timestamp = f"{date_str} {time_str}"
    dt = datetime.strptime(timestamp, "%Y-%m-%d %H:%M:%S")

    avg_amt = float(r.hget(hash_key, "Avg_Amount") or 0)
    last_large_date = r.hget(hash_key, "Last_Large_Date")
    today_count = int(r.hget(f"{hash_key}:tx:{today}", "count") or 0)

    avg_amt = round((avg_amt + amount) / 2, 2) if avg_amt > 0 else amount
    r.hincrby(f"{hash_key}:tx:{today}", "count", 1)

    yesterday = (dt - timedelta(days=1)).strftime("%Y-%m-%d")
    y_count = int(r.hget(f"{hash_key}:tx:{yesterday}", "count") or 0)
    tx_per_day = round((today_count + y_count) / 2, 2)

    month_key = dt.strftime("%Y-%m")
    r.hincrby(f"{hash_key}:velocity:{month_key}", "count", 1)
    velocity_data = r.hgetall(f"{hash_key}:velocity:{month_key}")
    monthly_counts = [int(v) for v in velocity_data.values()] if velocity_data else [1]
    velocity = round(np.mean(monthly_counts), 2) if monthly_counts else 1.0

    large_txn_flag = 1 if amount > 1.5 * avg_amt else 0
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

                        merchant_code = MERCHANT_MAP.get(merchant, 0)
                        device_code = DEVICE_MAP.get(device, 0)

                        features = compute_dynamic_features(user_id, amount, date_str, time_str)

                        feature_vector = {
                            "Amount": amount,
                            "Avg_Amount": features["Avg_Amount"],
                            "Active_Loan_Count": active_loans,
                            "Session_Time": session_time,
                            "Transactions_Per_Day": features["Transactions_Per_Day"],
                            "Velocity": features["Velocity"],
                            "Large_Transaction_Flag": features["Large_Transaction_Flag"],
                            "Large_Transaction_Frequency": features["Large_Transaction_Frequency"],
                            "Merchant_Type_Code": merchant_code,
                            "Device_Type_Code": device_code
                        }

                        cluster_info = user_cluster_map.get(user_id)
                        cluster = cluster_info["Cluster"] if cluster_info else None
                        if cluster == -1:
                            cluster = None  # treat as unassigned → fallback
                        X = np.array([feature_vector[k] for k in feature_vector]).reshape(1, -1)

                        # ------------------ Model Prediction ------------------
                        fallback_used = False
                        if cluster is not None:
                            try:
                                model_bundle = joblib.load(f"cluster_models/cluster_{cluster}_bundle.pkl")
                                model, scaler, score_min, score_max = model_bundle
                                X_scaled = scaler.transform(X)

                                score = model.decision_function(X_scaled)[0]

                                # Normalize using actual training score range
                                if score_max != score_min:
                                    prob = (score - score_min) / (score_max - score_min)
                                else:
                                    prob = 0.5  # fallback if all training scores were same

                            except FileNotFoundError:
                                if fallback_model and fallback_scaler:
                                    fallback_used = True
                                    cluster = "Fallback"

                                    fallback_vector = np.array([[
                                        amount,
                                        active_loans,
                                        session_time,
                                        feature_vector["Transactions_Per_Day"],        # → Transactions_Per_Unit_Time
                                        feature_vector["Velocity"],
                                        feature_vector["Large_Transaction_Flag"],      # → High_Value_Transaction
                                        feature_vector["Large_Transaction_Frequency"], # → Large_Transaction_Freq
                                        merchant_code,                                 # → Payment_Method
                                        device_code                                    # → Device_Type
                                    ]])

                                    X_scaled = fallback_scaler.transform(fallback_vector)
                                    pred = fallback_model.predict(X_scaled)[0]
                                    prob = 1.0 if pred == 1 else 0.0
                                else:
                                    print("⚠️ No model or fallback available.")
                                    pred = None
                                    prob = None

                        elif fallback_model and fallback_scaler:
                            fallback_used = True
                            cluster = "Fallback"

                            # Fallback prediction logic
                            payment_method = tx.get("Payment_Method", "Credit Card")
                            PAYMENT_METHOD_MAP = {'Credit Card': 0, 'Debit Card': 1, 'UPI': 2, 'Net Banking': 3, 'Wallet': 4}
                            payment_method_code = PAYMENT_METHOD_MAP.get(payment_method, 0)

                            transactions_per_unit_time = feature_vector["Transactions_Per_Day"]
                            high_value_transaction = feature_vector["Large_Transaction_Flag"]
                            large_transaction_freq = feature_vector["Large_Transaction_Frequency"]

                            fallback_vector = np.array([[
                                amount,
                                active_loans,
                                session_time,
                                transactions_per_unit_time,
                                feature_vector["Velocity"],
                                high_value_transaction,
                                large_transaction_freq,
                                payment_method_code,
                                device_code
                            ]])

                            X_scaled = fallback_scaler.transform(fallback_vector)
                            pred = fallback_model.predict(X_scaled)[0]
                            prob = 1.0 if pred == 1 else 0.0

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
                            r.hset(user_hash_key, mapping={
                                "Avg_Amount": feature_vector["Avg_Amount"],
                                "Active_Loan_Count": feature_vector["Active_Loan_Count"],
                                "Transactions_Per_Day": feature_vector["Transactions_Per_Day"],
                                "Velocity": feature_vector["Velocity"],
                                "Large_Transaction_Frequency": feature_vector["Large_Transaction_Frequency"],
                                "Large_Transaction_Flag": feature_vector["Large_Transaction_Flag"]
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