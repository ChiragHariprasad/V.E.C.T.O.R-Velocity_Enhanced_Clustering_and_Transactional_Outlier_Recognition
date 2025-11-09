import numpy as np
import pandas as pd

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

FEATURE_KEYS = [
    'Amount',
    'Avg_Amount',
    'Active_Loan_Count',
    'Session_Time',
    'Transactions_Per_Day',
    'Velocity',
    'Large_Transaction_Flag',
    'Large_Transaction_Frequency',
    'Merchant_Type_Code',
    'Device_Type_Code'
]

def extract_transaction_features(user_data):
    features = []
    amounts = user_data['Amount'].astype(float)
    user_avg = amounts.mean()
    user_data = user_data.copy()
    if 'Date' in user_data.columns:
        user_data['Date'] = pd.to_datetime(user_data['Date'])
        user_data = user_data.sort_values('Date')
    for idx, row in user_data.iterrows():
        tx_features = {}
        tx_features['Amount'] = float(row['Amount'])
        tx_features['Amount_Deviation'] = abs(float(row['Amount']) - user_avg)
        tx_features['Amount_Ratio'] = float(row['Amount']) / max(user_avg, 1.0)
        tx_features['Session_Time'] = float(row.get('Session_Time', 0))
        tx_features['Active_Loan_Count'] = float(row.get('Active_Loan_Count', 0))
        merchant_code = MERCHANT_MAP.get(row.get('Merchant_Category', ''), 0)
        device_code = DEVICE_MAP.get(row.get('Device_Type', ''), 0)
        tx_features['Merchant_Type_Code'] = float(merchant_code)
        tx_features['Device_Type_Code'] = float(device_code)
        if 'Date' in user_data.columns:
            tx_features['Hour_Of_Day'] = float(row['Date'].hour)
            tx_features['Day_Of_Week'] = float(row['Date'].weekday())
        else:
            tx_features['Hour_Of_Day'] = 12.0
            tx_features['Day_Of_Week'] = 1.0
        features.append(tx_features)
    return pd.DataFrame(features)

def add_derived_features(centroid, all_data, normal_data, original_user_data):
    if 'Amount' in centroid:
        centroid['Avg_Amount'] = centroid['Amount']
    if 'Date' in original_user_data.columns:
        dates = pd.to_datetime(original_user_data['Date'])
        date_range = (dates.max() - dates.min()).days + 1
        centroid['Transactions_Per_Day'] = float(len(normal_data) / max(date_range, 1))
        months = dates.dt.to_period('M').nunique()
        centroid['Velocity'] = float(len(normal_data) / max(months, 1))
    else:
        centroid['Transactions_Per_Day'] = 1.0
        centroid['Velocity'] = 1.0
    if 'Amount' in normal_data.columns:
        normal_amounts = normal_data['Amount']
        avg_normal_amount = normal_amounts.mean()
        large_threshold = avg_normal_amount * 1.5
        all_amounts = all_data['Amount']
        large_txns = all_amounts[all_amounts > large_threshold]
        centroid['Large_Transaction_Flag'] = float(1 if len(large_txns) > 0 else 0)
        if len(large_txns) > 1 and 'Date' in original_user_data.columns:
            total_days = (pd.to_datetime(original_user_data['Date']).max() - pd.to_datetime(original_user_data['Date']).min()).days + 1
            large_tx_freq = total_days / max(len(large_txns), 1)
            centroid['Large_Transaction_Frequency'] = float(large_tx_freq)
        else:
            centroid['Large_Transaction_Frequency'] = 30.0
    else:
        centroid['Large_Transaction_Flag'] = 0.0
        centroid['Large_Transaction_Frequency'] = 30.0
    return centroid

def fallback_simple_aggregation(user_data):
    amounts = user_data['Amount'].astype(float)
    session_times = user_data.get('Session_Time', pd.Series([0])).astype(float)
    active_loans = user_data.get('Active_Loan_Count', pd.Series([0])).astype(int)
    if 'Date' in user_data.columns:
        dates = pd.to_datetime(user_data['Date'])
        date_range = (dates.max() - dates.min()).days + 1
        tx_per_day = len(user_data) / max(date_range, 1)
        months = dates.dt.to_period('M').nunique()
        velocity = len(user_data) / max(months, 1)
    else:
        tx_per_day = 1.0
        velocity = 1.0
    avg_amount = amounts.mean()
    large_threshold = avg_amount * 1.5
    large_txns = amounts[amounts > large_threshold]
    large_txn_flag = 1 if len(large_txns) > 0 else 0
    merchant_categories = user_data.get('Merchant_Category', pd.Series(['']))
    device_types = user_data.get('Device_Type', pd.Series(['']))
    most_common_merchant = merchant_categories.mode().iloc[0] if len(merchant_categories.mode()) > 0 else ''
    most_common_device = device_types.mode().iloc[0] if len(device_types.mode()) > 0 else ''
    merchant_code = MERCHANT_MAP.get(most_common_merchant, 0)
    device_code = DEVICE_MAP.get(most_common_device, 0)
    return {
        'Amount': float(avg_amount),
        'Avg_Amount': float(avg_amount),
        'Active_Loan_Count': float(active_loans.mean()),
        'Session_Time': float(session_times.mean()),
        'Transactions_Per_Day': float(tx_per_day),
        'Velocity': float(velocity),
        'Large_Transaction_Flag': float(large_txn_flag),
        'Large_Transaction_Frequency': 30.0,
        'Merchant_Type_Code': float(merchant_code),
        'Device_Type_Code': float(device_code)
    }
