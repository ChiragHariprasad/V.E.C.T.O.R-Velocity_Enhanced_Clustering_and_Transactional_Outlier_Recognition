import redis
import pandas as pd
import time
import ast

# Connect to Redis
r = redis.Redis(host='localhost', port=6379, decode_responses=True)

# Load the synthetic transaction CSV
csv_path = "synthetic_txns.csv"
df = pd.read_csv(csv_path)
df = df.sample(frac=1).reset_index(drop=True)  # Shuffle rows

print(f"✅ Loaded {len(df)} records from {csv_path}")

stream_key = "csv_to_producer"

for idx, row in df.iterrows():
    # Convert row to dictionary
    row_dict = {
        "User_ID": row["User_ID"],
        "Date": row["Date"],                # preserved from CSV
        "Time": row["Time"],                # preserved from CSV
        "Amount": str(row["Amount"]),
        "Merchant_Category": row["Merchant_Category"],
        "Device_Type": row["Device_Type"],
        "Session_Time": str(row["Session_Time"]),
        "Active_Loans": str(row.get("Active_Loans", 0))  # default to 0 if not present
    }

    # Push dictionary to Redis stream
    r.xadd(stream_key, {"data": str(row_dict)})
    print(f"📤 Sent row {idx+1}/{len(df)} -> {row_dict['User_ID']} at {row_dict['Date']} {row_dict['Time']}")
    time.sleep(1)

