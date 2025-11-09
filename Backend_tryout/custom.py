import redis
import time
from datetime import datetime
import random
import smtplib
import ssl
import random
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_otp(receiver_email):
    otp = str(random.randint(100000, 999999))

    subject = "Your 2FA Verification Code"
    body = f"Your One-Time Password (OTP) for verification is: {otp}\n\nDo not share this with anyone."

    message = MIMEMultipart()
    message["From"] = sender_email
    message["To"] = receiver_email
    message["Subject"] = subject
    message.attach(MIMEText(body, "plain"))

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, receiver_email, message.as_string())
        print("✅ OTP has been sent to your email.")
        return otp
    except Exception as e:
        print(f"❌ Failed to send email: {e}")
        return None

# Redis Setup
r = redis.Redis(host='localhost', port=6379, decode_responses=True)
stream_key = "custom_input_stream"

MERCHANT_CATEGORIES = [
    'Luxury Goods', 'Travel', 'Electronics', 'Apparel', 'Food Delivery',
    'Online Services', 'Groceries', 'Utilities', 'Medical', 'Wellness',
    'Organic Grocery', 'Jewelry', 'Health', 'Hygiene Products',
    'Apparel (gifts)', 'Food', 'Apparel Deals'
]

def display_merchant_menu():
    print("\nSelect Merchant Category:")
    for idx, category in enumerate(MERCHANT_CATEGORIES):
        print(f"  {idx}. {category}")

def generate_transaction(user_id, amount, merchant, response_key):
    now = datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H:%M:%S")
    session_time = round(random.uniform(5, 15), 2)
    active_loans = str(random.randint(0, 5))

    txn = {
        "User_ID": user_id,
        "Date": date_str,
        "Time": time_str,
        "Amount": str(amount),
        "Merchant_Category": merchant,
        "Device_Type": 'Mobile',
        "Session_Time": str(session_time),
        "Active_Loans": active_loans,
        "response_key": response_key
    }

    return txn

def send_transaction(user_id, amount, merchant):
    response_key = f"response:{user_id}:{int(time.time())}"
    txn = generate_transaction(user_id, amount, merchant, response_key)

    message_data = {"data": str(txn)}
    r.xadd(stream_key, message_data)
    print("📤 Transaction sent to Redis Stream.")
    print("⏳ Waiting for prediction response...")

    for _ in range(20):  # wait up to 10 seconds
        if r.exists(response_key):
            result = r.hgetall(response_key)
            fraud_score = result.get('fraud_score')
            category = result.get('category')

            print("\n✅ Prediction Received:")
            print(f"   Fraud Score : {fraud_score}")
            print(f"   Category    : {category}")
            r.delete(response_key)

            # 🔐 2FA ONLY for Suspicious
            if category == "🟨 Suspicious":
                user_email = 'amogh4177@gmail.com'
                otp = send_otp(user_email)
                if not otp:
                    print("❌ Unable to send OTP. Transaction aborted.")
                    return

                user_input = input("🔐 Enter the OTP received: ").strip()
                if user_input == otp:
                    print("✅ OTP verified. Transaction allowed.")
                else:
                    print("❌ Invalid OTP. Transaction blocked.")
                    return

            return
        time.sleep(0.5)



    print("❌ No response received. Is the consumer running and returning predictions?")

# ========== Main Loop ==========
if __name__ == "__main__":
    print("🚀 Custom Transaction Producer (with Terminal Prediction)")

    try:
        while True:
            user_id = input("\nEnter User ID: ").strip()
            amount = input("Enter Transaction Amount: ").strip()

            display_merchant_menu()
            while True:
                choice = input("Enter Merchant Category Number: ").strip()
                if choice.isdigit() and 0 <= int(choice) < len(MERCHANT_CATEGORIES):
                    merchant = MERCHANT_CATEGORIES[int(choice)]
                    break
                else:
                    print("❌ Invalid choice. Try again.")

            send_transaction(user_id, amount, merchant)

    except KeyboardInterrupt:
        print("\n👋 Exiting producer...")
