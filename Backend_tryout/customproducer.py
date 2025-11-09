import streamlit as st
import pymongo
import redis
import datetime
import time
import uuid
import platform
import json
import smtplib
from email.mime.text import MIMEText
import secrets
from streamlit_js_eval import streamlit_js_eval

# -------------------------------
# Email Configuration
# -------------------------------


# -------------------------------
# Page Configuration
# -------------------------------
st.set_page_config(
    page_title="V.E.C.T.O.R Banking Portal",
    page_icon="🏦",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# -------------------------------
# Custom CSS
# -------------------------------
st.markdown("""
<style>
    /* Hide Streamlit branding */
    .css-1jc7ptx, .e1ewe7hr3, .viewerBadge_container__1QSob,
    .styles_viewerBadge__1yB5_, #MainMenu, header, footer {visibility: hidden;}
    
    /* Main container styling */
    .main {
        padding: 0;
    }
    
    /* Custom header */
    .vector-header {
        background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
        padding: 20px 40px;
        color: white;
        margin: -1rem -1rem 2rem -1rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    
    .vector-title {
        font-size: 2.5rem;
        font-weight: 700;
        margin: 0;
        letter-spacing: 2px;
    }
    
    .vector-subtitle {
        font-size: 0.9rem;
        opacity: 0.9;
        margin: 5px 0 0 0;
        font-weight: 300;
    }
    
    /* Navigation */
    .nav-container {
        background: white;
        padding: 0;
        margin: -1rem -1rem 2rem -1rem;
        border-bottom: 1px solid #e0e0e0;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }
    
    .nav-tabs {
        display: flex;
        background: #f8f9fa;
        margin: 0;
        padding: 0;
    }
    
    .nav-tab {
        flex: 1;
        padding: 15px 20px;
        text-align: center;
        background: #f8f9fa;
        border: none;
        cursor: pointer;
        font-weight: 500;
        color: #666;
        border-right: 1px solid #e0e0e0;
        transition: all 0.3s ease;
    }
    
    .nav-tab:hover {
        background: #e9ecef;
        color: #333;
    }
    
    .nav-tab.active {
        background: white;
        color: #2a5298;
        border-bottom: 3px solid #2a5298;
    }
    
    /* Cards */
    .card {
        background: white;
        border-radius: 12px;
        padding: 30px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
        border: 1px solid #e9ecef;
        margin-bottom: 20px;
    }
    
    .card-header {
        font-size: 1.3rem;
        font-weight: 600;
        color: #2c3e50;
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 2px solid #f1f3f4;
    }
    
    /* Form styling */
    .stTextInput > div > div > input,
    .stNumberInput > div > div > input,
    .stSelectbox > div > div > select {
        border: 2px solid #e9ecef !important;
        border-radius: 8px !important;
        padding: 12px 16px !important;
        font-size: 16px !important;
        transition: border-color 0.3s ease !important;
    }
    
    .stTextInput > div > div > input:focus,
    .stNumberInput > div > div > input:focus,
    .stSelectbox > div > div > select:focus {
        border-color: #2a5298 !important;
        box-shadow: 0 0 0 3px rgba(42, 82, 152, 0.1) !important;
    }
    
    /* Button styling */
    .stButton > button {
        background: linear-gradient(135deg, #2a5298 0%, #1e3c72 100%) !important;
        color: white !important;
        border: none !important;
        border-radius: 8px !important;
        padding: 12px 30px !important;
        font-weight: 600 !important;
        font-size: 16px !important;
        transition: all 0.3s ease !important;
        width: 100% !important;
    }
    
    .stButton > button:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 6px 12px rgba(42, 82, 152, 0.3) !important;
    }
    
    /* Status indicators */
    .status-card {
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        border-radius: 10px;
        padding: 20px;
        text-align: center;
        margin: 10px 0;
    }
    
    .status-success {
        background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
        color: #155724;
        border-left: 4px solid #28a745;
    }
    
    .status-warning {
        background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
        color: #856404;
        border-left: 4px solid #ffc107;
    }
    
    .status-danger {
        background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%);
        color: #721c24;
        border-left: 4px solid #dc3545;
    }
    
    /* Table styling */
    .dataframe {
        border-radius: 8px !important;
        overflow: hidden !important;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05) !important;
    }
    
    /* SVG icon styling */
    .svg-icon {
        display: inline-flex;
        align-items: center;
        margin-right: 8px;
        vertical-align: middle;
    }
    
    /* 2FA styling */
    .twofa-container {
        background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%);
        border-radius: 10px;
        padding: 20px;
        margin: 20px 0;
        border-left: 4px solid #ffa000;
    }
    
    /* Responsive design */
    @media (max-width: 768px) {
        .vector-header {
            padding: 15px 20px;
        }
        .vector-title {
            font-size: 2rem;
        }
        .card {
            padding: 20px;
        }
        .nav-tab {
            padding: 12px 15px;
            font-size: 14px;
        }
    }
</style>
""", unsafe_allow_html=True)

# -------------------------------
# MongoDB Setup
# -------------------------------
@st.cache_resource
def init_mongo():
    mongo_client = pymongo.MongoClient("mongodb://localhost:27017/")
    db = mongo_client["RedisTransactions"]
    return db["fraud_transactions"], db["legit_transactions"]

fraud_collection, legit_collection = init_mongo()

# -------------------------------
# Redis Setup
# -------------------------------
@st.cache_resource
def init_redis():
    return redis.Redis(host='localhost', port=6379, decode_responses=True)

r = init_redis()
stream_name = 'custom_input_stream'

# -------------------------------
# Session State Setup
# -------------------------------
if "logged_in" not in st.session_state:
    st.session_state.logged_in = False
if "user_id" not in st.session_state:
    st.session_state.user_id = None
if "start_time" not in st.session_state:
    st.session_state.start_time = None
if "active_loans" not in st.session_state:
    st.session_state.active_loans = None
if "current_page" not in st.session_state:
    st.session_state.current_page = "login"
if "session_timer_started" not in st.session_state:
    st.session_state.session_timer_started = False
if "verification_code" not in st.session_state:
    st.session_state.verification_code = None
if "verification_txn" not in st.session_state:
    st.session_state.verification_txn = None
if "verification_attempts" not in st.session_state:
    st.session_state.verification_attempts = 0

# -------------------------------
# Device Detection
# -------------------------------
def get_device_type():
    """Enhanced device detection"""
    try:
        # Try to get user agent from JavaScript
        user_agent = streamlit_js_eval(js_expressions="navigator.userAgent", key="user_agent")
        if user_agent:
            user_agent = user_agent.lower()
            if any(mobile in user_agent for mobile in ['mobile', 'android', 'iphone', 'ipad']):
                return 'Mobile'
            elif 'tablet' in user_agent:
                return 'Tablet'
            else:
                return 'Desktop'
    except:
        pass
    
    # Fallback to platform detection
    system = platform.system()
    if system == 'Windows':
        return 'Desktop-Windows'
    elif system == 'Darwin':
        return 'Desktop-MacOS'
    elif system == 'Linux':
        return 'Desktop-Linux'
    else:
        return 'Desktop-Other'

# -------------------------------
# SVG Icons
# -------------------------------
def get_svg_icon(icon_name, size=24, color="#2a5298"):
    icons = {
        "bank": f"""<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 24 24" fill="{color}">
                   <path d="M12 2L2 7V9H22V7L12 2Z"/>
                   <path d="M4 11V19H6V11H4Z"/>
                   <path d="M10 11V19H12V11H10Z"/>
                   <path d="M16 11V19H18V11H16Z"/>
                   <path d="M2 21H22V19H2V21Z"/>
                   </svg>""",
        "user": f"""<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="2">
                   <circle cx="12" cy="8" r="4"/>
                   <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                   </svg>""",
        "transaction": f"""<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="2">
                          <path d="M7 16L17 6M17 6H12M17 6V11"/>
                          <circle cx="5" cy="19" r="2"/>
                          <circle cx="19" cy="5" r="2"/>
                          </svg>""",
        "history": f"""<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="2">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                      </svg>""",
        "security": f"""<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="2">
                       <path d="M12 2L3 7V13C3 17.55 6.84 21.74 12 23C17.16 21.74 21 17.55 21 13V7L12 2Z"/>
                       <path d="M9 12L11 14L15 10"/>
                       </svg>""",
        "email": f"""<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                    </svg>"""
    }
    return icons.get(icon_name, "")

# -------------------------------
# Email Functions
# -------------------------------
def send_verification_email(user_id, verification_code):
    """Send verification email via Brevo SMTP"""
    recipient = EMAIL_CONFIG["user_mapping"].get(user_id, EMAIL_CONFIG["user_mapping"]["default"])
    
    subject = "V.E.C.T.O.R Banking - Transaction Verification Code"
    body = f"""
    <html>
    <body>
        <h2 style="color: #2a5298;">Transaction Verification</h2>
        <p>Your verification code is: <strong>{verification_code}</strong></p>
        <p>This code is valid for 10 minutes.</p>
        <p style="color: #666; font-size: 12px;">
            If you didn't initiate this transaction, please contact our support immediately.
        </p>
    </body>
    </html>
    """
    
    msg = MIMEText(body, 'html')
    msg['Subject'] = subject
    msg['From'] = EMAIL_CONFIG["sender"]
    msg['To'] = recipient
    
    try:
        with smtplib.SMTP(EMAIL_CONFIG["server"], EMAIL_CONFIG["port"]) as smtp_server:
            smtp_server.starttls()  # Enable TLS
            smtp_server.login(EMAIL_CONFIG["sender"], EMAIL_CONFIG["password"])
            smtp_server.send_message(msg)
        return True
    except Exception as e:
        st.error(f"Failed to send verification email: {str(e)}")
        return False

# -------------------------------
# Header Component
# -------------------------------
def render_header():
    st.markdown(f"""
    <div class="vector-header">
        <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center;">
                <div class="svg-icon">{get_svg_icon("bank", 40, "white")}</div>
                <div style="margin-left: 15px;">
                    <h1 class="vector-title">V.E.C.T.O.R</h1>
                    <p class="vector-subtitle">Velocity-Enhanced Clustering for Transactional Outlier Recognition</p>
                </div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 0.9rem; opacity: 0.9;">Secure Banking Portal</div>
                <div style="font-size: 0.8rem; opacity: 0.7;">{datetime.datetime.now().strftime("%A, %B %d, %Y")}</div>
            </div>
        </div>
    </div>
    """, unsafe_allow_html=True)

# -------------------------------
# Navigation Component
# -------------------------------
def render_navigation():
    if st.session_state.logged_in:
        st.markdown("""
        <div class="nav-container">
            <div class="nav-tabs">
        """, unsafe_allow_html=True)

        col1, col2, col3, col4 = st.columns(4)

        with col1:
            if st.button(f"Dashboard", key="nav_dashboard", use_container_width=True):
                st.session_state.current_page = "dashboard"
                st.rerun()

        with col2:
            if st.button(f"New Transaction", key="nav_transaction", use_container_width=True):
                st.session_state.current_page = "transaction"
                if not st.session_state.session_timer_started:
                    st.session_state.start_time = time.time()
                    st.session_state.session_timer_started = True
                st.rerun()

        with col3:
            if st.button(f"Transaction History", key="nav_history", use_container_width=True):
                st.session_state.current_page = "history"
                st.rerun()

        with col4:
            if st.button("Logout", key="nav_logout", use_container_width=True):
                for key in ["logged_in", "user_id", "start_time", "active_loans", "session_timer_started"]:
                    if key in st.session_state:
                        del st.session_state[key]
                st.session_state.current_page = "login"
                st.rerun()

        st.markdown("</div></div>", unsafe_allow_html=True)

# -------------------------------
# Login Page
# -------------------------------
def render_login():
    st.markdown('<div class="card">', unsafe_allow_html=True)
    st.markdown(f'<div class="card-header">Secure Authentication</div>', unsafe_allow_html=True)
    
    with st.form("login_form", clear_on_submit=False):
        col1, col2 = st.columns([1, 1])
        
        with col1:
            user_id = st.text_input("User ID", placeholder="Enter your unique user ID")
        
        with col2:
            password = st.text_input("Password", type="password", placeholder="Enter VECTOR123")
        
        new_user = st.checkbox("New User Registration")
        
        if new_user:
            active_loans = st.number_input("Active Loan Count", min_value=0, step=1, help="Number of active loans you currently have")
        
        submit = st.form_submit_button("Access Banking Portal")
        
        if submit:
            if password == "VECTOR123":
                st.session_state.user_id = user_id
                st.session_state.logged_in = True
                st.session_state.current_page = "dashboard"
                
                if new_user:
                    st.session_state.active_loans = active_loans if new_user else 0
                    st.success(f"✓ Successfully registered {user_id} with {active_loans} active loans.")
                else:
                    st.session_state.active_loans = 0
                    st.success(f"✓ Welcome back, {user_id}!")
                
                time.sleep(1)
                st.rerun()
            else:
                st.error("❌ Invalid credentials. Please use the correct password.")
    
    st.markdown('</div>', unsafe_allow_html=True)
    
    # Security notice
    st.markdown("""
    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-top: 20px; border-left: 4px solid #2a5298;">
        <div style="display: flex; align-items: center; margin-bottom: 10px;">
            <strong style="color: #2a5298;">Security Notice</strong>
        </div>
        <p style="margin: 0; color: #666; font-size: 14px;">
            This is a secure transaction monitoring system. All activities are logged and monitored for security purposes.
            Default password: <code>VECTOR123</code>
        </p>
    </div>
    """, unsafe_allow_html=True)

# -------------------------------
# Dashboard Page
# -------------------------------
def render_dashboard():
    st.markdown('<div class="card">', unsafe_allow_html=True)
    st.markdown(f'<div class="card-header">User Dashboard</div>', unsafe_allow_html=True)
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.markdown(f"""
        <div class="status-card">
            <h3 style="margin: 0; color: #2a5298;">User ID</h3>
            <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: 600;">{st.session_state.user_id}</p>
        </div>
        """, unsafe_allow_html=True)
    
    with col2:
        active_loans = st.session_state.active_loans if st.session_state.active_loans is not None else 0
        st.markdown(f"""
        <div class="status-card">
            <h3 style="margin: 0; color: #2a5298;">Active Loans</h3>
            <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: 600;">{active_loans}</p>
        </div>
        """, unsafe_allow_html=True)
    
    with col3:
        device_type = get_device_type()
        st.markdown(f"""
        <div class="status-card">
            <h3 style="margin: 0; color: #2a5298;">Device Type</h3>
            <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: 600;">{device_type}</p>
        </div>
        """, unsafe_allow_html=True)
    
    st.markdown('</div>', unsafe_allow_html=True)
    
    # Quick stats
    st.markdown('<div class="card">', unsafe_allow_html=True)
    st.markdown('<div class="card-header">Account Overview</div>', unsafe_allow_html=True)
    
    # Get transaction counts
    legit_count = legit_collection.count_documents({"User_ID": st.session_state.user_id})
    fraud_count = fraud_collection.count_documents({"User_ID": st.session_state.user_id})
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.markdown(f"""
        <div class="status-card status-success">
            <h3 style="margin: 0;">Approved Transactions</h3>
            <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: 700;">{legit_count}</p>
        </div>
        """, unsafe_allow_html=True)
    
    with col2:
        st.markdown(f"""
        <div class="status-card status-danger">
            <h3 style="margin: 0;">Flagged Transactions</h3>
            <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: 700;">{fraud_count}</p>
        </div>
        """, unsafe_allow_html=True)
    
    with col3:
        total = legit_count + fraud_count
        st.markdown(f"""
        <div class="status-card">
            <h3 style="margin: 0;">Total Transactions</h3>
            <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: 700;">{total}</p>
        </div>
        """, unsafe_allow_html=True)
    
    st.markdown('</div>', unsafe_allow_html=True)

# -------------------------------
# 2FA Verification Component
# -------------------------------
def render_2fa_verification():
    st.markdown('<div class="twofa-container">', unsafe_allow_html=True)
    st.markdown(f'<h3>{get_svg_icon("email", 20)} Email Verification Required</h3>', unsafe_allow_html=True)
    st.markdown('<p>Please check your email and enter the 6-digit verification code to confirm this transaction.</p>', unsafe_allow_html=True)

    # Create a separate form for the resend code button
    with st.form("resend_code_form"):
        if st.form_submit_button("Resend Code"):
            st.session_state.verification_code = str(secrets.randbelow(900000) + 100000)  # Generate new 6-digit code
            if send_verification_email(st.session_state.user_id, st.session_state.verification_code):
                st.success("Verification code resent to your registered email address")
            else:
                st.error("Failed to resend verification code. Please try again.")

    # Verification Form
    with st.form("2fa_form"):
        code = st.text_input("Verification Code", placeholder="Enter 6-digit code", max_chars=6)
        submit = st.form_submit_button("Verify Transaction")

        if submit:
            if code == st.session_state.verification_code:
                # Verification successful - mark as legit
                txn = st.session_state.verification_txn
                txn["legit_token"] = secrets.token_hex(8)
                txn["Prediction"] = "Legit (2FA Verified)"
                legit_collection.insert_one(txn)

                # Update user features in Redis
                user_hash_key = f"user:{st.session_state.user_id}"
                r.hset(user_hash_key, mapping={
                    "Avg_Amount": txn["Amount"],
                    "Active_Loan_Count": txn["Active_Loans"],
                    "Transactions_Per_Day": 1,
                    "Velocity": 0,
                    "Large_Transaction_Frequency": 0,
                    "Large_Transaction_Flag": 0
                })
                r.hincrby(user_hash_key, "Transaction_Count", 1)

                st.success("✓ Transaction verified and processed successfully")
                st.session_state.verification_code = None
                st.session_state.verification_txn = None
                st.rerun()
            else:
                st.session_state.verification_attempts += 1
                if st.session_state.verification_attempts >= 3:
                    st.error("Too many failed attempts. Transaction cancelled.")
                    st.session_state.verification_code = None
                    st.session_state.verification_txn = None
                else:
                    st.error("Invalid verification code. Please try again.")

    st.markdown('</div>', unsafe_allow_html=True)
    
# -------------------------------
# Transaction Page
# -------------------------------
def render_transaction():
    # Session timer display
    if st.session_state.session_timer_started and st.session_state.start_time:
        elapsed_time = int(time.time() - st.session_state.start_time)
        st.markdown(f"""
        <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); 
                    padding: 15px; border-radius: 10px; margin-bottom: 20px; 
                    border-left: 4px solid #2196f3; text-align: center;">
            <div style="font-size: 18px; font-weight: 600; color: #1976d2;">
                Session Time: {elapsed_time} seconds
            </div>
        </div>
        """, unsafe_allow_html=True)

    st.markdown('<div class="card">', unsafe_allow_html=True)
    st.markdown(f'<div class="card-header">New Transaction</div>', unsafe_allow_html=True)

    if st.session_state.verification_code:
        # Render 2FA verification if a code is pending
        render_2fa_verification()
        return

    with st.form("txn_form", clear_on_submit=True):
        col1, col2 = st.columns(2)

        with col1:
            amount = st.number_input("Transaction Amount (₹)", min_value=1.0, step=0.01, format="%.2f")

        with col2:
            merchant_categories = [
                "", "Grocery", "Gas Station", "Restaurant", "Online Shopping", 
                "ATM", "Department Store", "Pharmacy", "Entertainment", 
                "Travel", "Utilities", "Insurance", "Other"
            ]
            merchant = st.selectbox("Merchant Category", merchant_categories)

        st.markdown("<br>", unsafe_allow_html=True)
        submit_txn = st.form_submit_button("Pay")

        if submit_txn and amount > 0:
            if not st.session_state.session_timer_started:
                st.error("Please start a new transaction session first.")
                return

            now = datetime.datetime.now()
            txn_id = str(uuid.uuid4())
            elapsed_time = int(time.time() - st.session_state.start_time) if st.session_state.start_time else 0

            data = {
                "Transaction_ID": txn_id,
                "User_ID": st.session_state.user_id,
                "Date": now.strftime("%Y-%m-%d"),
                "Time": now.strftime("%H:%M:%S"),
                "Amount": float(amount),
                "Merchant_Category": merchant or "Other",
                "Device_Type": get_device_type(),
                "Active_Loans": st.session_state.active_loans if st.session_state.active_loans is not None else 0,
                "Session_Time": elapsed_time
            }

            # Send to Redis stream
            r.xadd(stream_name, {"data": str(data)})

            st.success("✓ Transaction submitted for processing")

            # Real-time prediction polling
            st.markdown("**Processing Transaction...**")
            progress_bar = st.progress(0)
            status_placeholder = st.empty()

            prediction = None
            timeout = time.time() + 15  # 15 second timeout
            progress = 0

            while time.time() < timeout and prediction is None:
                # Check fraud collection
                result = fraud_collection.find_one({"Transaction_ID": txn_id})
                if result:
                    prediction = "Fraud"
                    break

                # Check legit collection
                result = legit_collection.find_one({"Transaction_ID": txn_id})
                if result:
                    prediction = "Legit"
                    break

                progress = min(progress + 7, 95)
                progress_bar.progress(progress)
                status_placeholder.info("Analyzing transaction patterns...")
                time.sleep(1)

            progress_bar.progress(100)

            if prediction == "Fraud":
                st.warning("⚠️ Transaction flagged as suspicious. Redirecting to 2FA verification...")
                st.session_state.verification_code = str(secrets.randbelow(900000) + 100000)  # Generate 6-digit code
                st.session_state.verification_txn = data
                render_2fa_verification()
            elif prediction == "Legit":
                st.success("✓ Transaction approved.")
            else:
                st.warning("⚠️ Transaction processing timed out. Redirecting to 2FA verification...")
                st.session_state.verification_code = str(secrets.randbelow(900000) + 100000)  # Generate 6-digit code
                st.session_state.verification_txn = data
                render_2fa_verification()

            # End session timer
            st.session_state.session_timer_started = False

    st.markdown('</div>', unsafe_allow_html=True)

# -------------------------------
# History Page
# -------------------------------
def render_history():
    st.markdown('<div class="card">', unsafe_allow_html=True)
    st.markdown(f'<div class="card-header">Transaction History</div>', unsafe_allow_html=True)
    
    # Get transactions
    legit_txns = list(legit_collection.find({"User_ID": st.session_state.user_id}).sort("Date", -1).sort("Time", -1))
    fraud_txns = list(fraud_collection.find({"User_ID": st.session_state.user_id}).sort("Date", -1).sort("Time", -1))
    
    tab1, tab2 = st.tabs(["✅ Approved Transactions", "🚨 Flagged Transactions"])
    
    with tab1:
        if legit_txns:
            # Clean data for display
            display_data = []
            for txn in legit_txns:
                clean_txn = {k: v for k, v in txn.items() if k != '_id'}
                clean_txn['Amount'] = f"₹{clean_txn['Amount']:.2f}"
                display_data.append(clean_txn)
            st.dataframe(display_data, use_container_width=True)
        else:
            st.info("No approved transactions found.")
    
    with tab2:
        if fraud_txns:
            # Clean data for display
            display_data = []
            for txn in fraud_txns:
                clean_txn = {k: v for k, v in txn.items() if k != '_id'}
                clean_txn['Amount'] = f"₹{clean_txn['Amount']:.2f}"
                display_data.append(clean_txn)
            st.dataframe(display_data, use_container_width=True)
        else:
            st.info("No flagged transactions found.")
    
    st.markdown('</div>', unsafe_allow_html=True)

# -------------------------------
# Main Application Logic
# -------------------------------
def main():
    # Render header
    render_header()
    
    # Handle navigation and page rendering
    if not st.session_state.logged_in:
        st.session_state.current_page = "login"
        render_login()
    else:
        render_navigation()
        
        if st.session_state.current_page == "dashboard":
            render_dashboard()
        elif st.session_state.current_page == "transaction":
            render_transaction()
        elif st.session_state.current_page == "history":
            render_history()
        else:
            render_dashboard()

if __name__ == "__main__":
    main()
