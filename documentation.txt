# TransactionIQ - Advanced Real-time Fraud Detection System
# =====================================================

## Table of Contents
1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Technical Stack](#technical-stack)
4. [Model Architecture](#model-architecture)
5. [Setup Instructions](#setup-instructions)
6. [Usage Guide](#usage-guide)
7. [API Documentation](#api-documentation)
8. [Model Training](#model-training)
9. [Performance Monitoring](#performance-monitoring)
10. [Security](#security)
11. [Troubleshooting](#troubleshooting)
12. [Contributing](#contributing)

## Project Overview
===================

TransactionIQ is a state-of-the-art real-time fraud detection system that leverages machine learning and big data technologies to identify potentially fraudulent transactions. The system employs a sophisticated hybrid approach combining user behavior clustering and anomaly detection to provide accurate and timely fraud predictions.

Key Features:
- Real-time transaction monitoring and fraud detection
- User behavior clustering for personalized fraud detection
- Advanced anomaly detection using Isolation Forest
- Fallback XGBoost model for edge cases
- Interactive real-time dashboard
- Comprehensive transaction analytics
- Historical data analysis and reporting

## System Architecture
=====================

### Backend Components

1. Data Processing Pipeline
--------------------------
a) Producer Components:
   - producer.py: Generates synthetic transaction data for testing
   - customproducer.py: Streamlit-based interface for manual transaction input
   - Features:
     * Real-time transaction generation
     * Custom transaction input
     * Transaction validation
     * Data format standardization

b) Consumer Components:
   - consumer.py: Main fraud detection engine
   - Features:
     * Real-time transaction processing
     * Feature extraction and engineering
     * Model prediction
     * Result persistence
     * Redis caching
     * MongoDB storage

c) Model Management:
   - trigger.py: Handles model training and user clustering
   - Features:
     * User clustering using HDBSCAN
     * Model training and validation
     * Feature preprocessing
     * Model persistence
     * Cluster mapping management

2. Database Layer
----------------
a) MongoDB:
   - Collections:
     * fraud_transactions: Stores detected fraudulent transactions
     * legit_transactions: Stores legitimate transactions
   - Indexes:
     * Transaction_ID
     * User_ID
     * Date
     * Fraud_Score

b) Redis:
   - Key-Value Storage:
     * User features
     * Transaction statistics
     * Real-time counters
   - Data Structures:
     * Hashes: User profiles
     * Sorted Sets: Transaction timestamps
     * Lists: Suspicion buffers

3. File Storage
--------------
- transactions.csv: Historical transaction data
- synthetic_txns.csv: Generated test transactions
- fraud.csv: Known fraudulent transactions
- fraud_scores_by_cluster.csv: Model performance metrics
- user_feature_data.json: User behavior features
- user_cluster_mapping.json: User-to-cluster assignments
- cluster_models/: Directory containing trained models

### Frontend Components

1. Real-time Dashboard
---------------------
a) Core Components:
   - React-based SPA with TypeScript
   - WebSocket integration for live updates
   - Responsive design using Tailwind CSS
   - Interactive charts using Chart.js
   - Smooth animations with Framer Motion

b) Key Features:
   - Live transaction monitoring
   - Real-time fraud score visualization
   - Transaction statistics and trends
   - Merchant and device type analysis
   - Advanced search and filtering
   - Historical data analysis

2. User Interface
----------------
a) Main Dashboard:
   - Transaction overview
   - Fraud statistics
   - Real-time alerts
   - Performance metrics
   - System status

b) Analysis Tools:
   - Transaction search
   - Filtering options
   - Data visualization
   - Export capabilities
   - Custom date ranges

## Project Structure and File Organization
=======================================

### Directory Structure
---------------------
```
TransactionIQ/
├── Backend/
│   ├── cluster_models/           # Trained model files
│   │   ├── cluster_*_bundle.pkl  # Cluster-specific models
│   │   └── fallback_xgboost_model.joblib
│   ├── __pycache__/             # Python cache files
│   ├── consumer.py              # Main fraud detection engine
│   ├── customproducer.py        # Streamlit interface
│   ├── producer.py              # Synthetic data generator
│   ├── trigger.py               # Model training and clustering
│   ├── transactions.csv         # Historical transaction data
│   ├── synthetic_txns.csv       # Generated test data
│   ├── fraud.csv               # Known fraudulent transactions
│   ├── fraud_scores_by_cluster.csv  # Model performance metrics
│   ├── user_feature_data.json   # User behavior features
│   └── user_cluster_mapping.json    # User-to-cluster assignments
│
├── Frontend/
│   ├── public/                  # Static assets
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── context/           # React context providers
│   │   ├── pages/             # Page components
│   │   ├── types/             # TypeScript type definitions
│   │   ├── App.tsx            # Main application component
│   │   ├── main.tsx           # Application entry point
│   │   └── socket.ts          # WebSocket configuration
│   ├── server/                 # Frontend server code
│   ├── node_modules/          # Node.js dependencies
│   ├── package.json           # Node.js project configuration
│   ├── tsconfig.json          # TypeScript configuration
│   └── vite.config.ts         # Vite configuration
│
└── documentation.txt          # Project documentation
```

### Key File Descriptions
-----------------------
1. Backend Files:
   - consumer.py: Core fraud detection logic
   - trigger.py: Model training and clustering
   - customproducer.py: Manual transaction interface
   - producer.py: Synthetic data generation

2. Frontend Files:
   - App.tsx: Main application component
   - Dashboard.tsx: Main dashboard view
   - TransactionContext.tsx: State management
   - ChartCard.tsx: Visualization components

## Transaction Flow and Processing
===============================

### 1. Transaction Lifecycle
--------------------------
```
[Transaction Input] → [Feature Extraction] → [Model Prediction] → [Result Storage]
       ↑                      ↑                     ↑                    ↑
       |                      |                     |                    |
[Producer/API]        [Consumer Engine]      [ML Models]         [MongoDB/Redis]
```

### 2. Detailed Flow
------------------
1. Transaction Input:
   ```
   a) Real-time Input:
      Producer/API → Redis Stream → Consumer
   
   b) Manual Input:
      Streamlit UI → Custom Producer → Redis Stream → Consumer
   ```

2. Feature Processing:
   ```
   a) Static Features:
      User Profile → Redis Cache → Feature Vector
   
   b) Dynamic Features:
      Transaction Data → Feature Engineering → Feature Vector
   ```

3. Model Prediction:
   ```
   a) Cluster Assignment:
      User ID → Cluster Map → Cluster-specific Model
   
   b) Score Calculation:
      Feature Vector → Model → Fraud Score
   
   c) Result Classification:
      Fraud Score → Threshold → Classification
   ```

4. Result Handling:
   ```
   a) Storage:
      Classification → MongoDB Collections
   
   b) Caching:
      User Stats → Redis Cache
   
   c) Real-time Updates:
      Results → WebSocket → Frontend
   ```

## Mathematical Models and Formulas
================================

### 1. User Clustering (HDBSCAN)
-----------------------------
1. Distance Metric:
   ```
   d(x,y) = √(Σ(x_i - y_i)²)
   where:
   - x, y are feature vectors
   - i represents feature dimensions
   ```

2. Density Calculation:
   ```
   ρ(x) = Σ K(d(x,y))
   where:
   - K is the kernel function
   - d(x,y) is the distance between points
   ```

3. Cluster Formation:
   ```
   C = {x | ρ(x) ≥ ρ_min}
   where:
   - C is a cluster
   - ρ_min is minimum density threshold
   ```

### 2. Fraud Detection (Isolation Forest)
-------------------------------------
1. Anomaly Score:
   ```
   s(x) = 2^(-E(h(x))/c(n))
   where:
   - h(x) is path length
   - c(n) is average path length
   - E is expected value
   ```

2. Path Length:
   ```
   h(x) = e + c(T.size)
   where:
   - e is number of edges
   - c is correction factor
   - T.size is tree size
   ```

3. Normalized Score:
   ```
   score(x) = (s(x) - s_min) / (s_max - s_min)
   where:
   - s_min is minimum score
   - s_max is maximum score
   ```

### 3. Feature Engineering
-----------------------
1. Transaction Velocity:
   ```
   V = n / Δt
   where:
   - n is number of transactions
   - Δt is time period
   ```

2. Large Transaction Detection:
   ```
   L = 1 if amount > (μ + kσ)
   where:
   - μ is mean transaction amount
   - σ is standard deviation
   - k is threshold multiplier
   ```

3. User Behavior Score:
   ```
   B = Σ(w_i * f_i)
   where:
   - w_i are feature weights
   - f_i are normalized features
   ```

### 4. Model Performance Metrics
----------------------------
1. Precision:
   ```
   P = TP / (TP + FP)
   where:
   - TP is true positives
   - FP is false positives
   ```

2. Recall:
   ```
   R = TP / (TP + FN)
   where:
   - FN is false negatives
   ```

3. F1 Score:
   ```
   F1 = 2 * (P * R) / (P + R)
   ```

4. ROC-AUC:
   ```
   AUC = ∫ TPR d(FPR)
   where:
   - TPR is true positive rate
   - FPR is false positive rate
   ```

### 5. Real-time Processing Metrics
-------------------------------
1. Processing Latency:
   ```
   L = t_end - t_start
   where:
   - t_start is transaction receipt time
   - t_end is prediction completion time
   ```

2. Throughput:
   ```
   T = n / Δt
   where:
   - n is number of processed transactions
   - Δt is time period
   ```

3. Cache Hit Rate:
   ```
   H = hits / (hits + misses)
   where:
   - hits is cache hits
   - misses is cache misses
   ```

## Technical Stack
=================

### Backend Requirements
----------------------
1. Python 3.x
2. Required Python Packages:
   - scikit-learn==1.3.0
   - xgboost==2.0.0
   - redis==5.0.1
   - pymongo==4.5.0
   - streamlit==1.28.0
   - pandas==2.1.1
   - numpy==1.24.3
   - umap-learn==0.5.4
   - hdbscan==0.8.33
   - joblib==1.3.2

3. Database Requirements:
   - MongoDB 6.0+
   - Redis 7.0+

### Frontend Requirements
-----------------------
1. Node.js 16+
2. Required npm Packages:
   - react==18.2.0
   - react-dom==18.2.0
   - typescript==5.2.2
   - tailwindcss==3.3.3
   - chart.js==4.4.0
   - socket.io-client==4.7.2
   - framer-motion==10.16.4
   - date-fns==2.30.0
   - axios==1.6.2
   - lucide-react==0.294.0

## Model Architecture
====================

### 1. User Clustering
---------------------
a) Algorithm: HDBSCAN (Hierarchical Density-Based Spatial Clustering)
   - Parameters:
     * min_cluster_size: 5
     * min_samples: 3
     * metric: 'euclidean'

b) Clustering Features:
   - Transaction Patterns:
     * Average transaction amount
     * Transaction frequency
     * Session duration
     * Active loan count
   - Behavioral Patterns:
     * Device usage distribution
     * Merchant category preferences
     * Time-based patterns
     * Transaction velocity

### 2. Fraud Detection Models
---------------------------
a) Cluster-specific Models:
   - Algorithm: Isolation Forest
   - Parameters:
     * contamination: 0.1
     * n_estimators: 100
     * random_state: 42
   - Features:
     * Transaction amount
     * Session time
     * Transaction velocity
     * Large transaction flags
     * Device type code
     * Merchant type code
     * Active loan count
     * Transaction frequency

b) Fallback Model:
   - Algorithm: XGBoost
   - Parameters:
     * max_depth: 6
     * learning_rate: 0.1
     * n_estimators: 100
   - Features: Same as cluster models
   - Purpose: Handle edge cases and new users

### 3. Feature Engineering
------------------------
a) Static Features:
   - User demographics
   - Historical patterns
   - Device preferences
   - Merchant preferences

b) Dynamic Features:
   - Transaction velocity
   - Average amount
   - Large transaction frequency
   - Session duration
   - Device and merchant encoding
   - Time-based patterns

## Setup Instructions
====================

### Prerequisites Installation
----------------------------
1. System Requirements:
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install python3-pip python3-venv nodejs npm mongodb redis-server

   # Fedora
   sudo dnf update
   sudo dnf install python3-pip python3-venv nodejs npm mongodb-org redis
   ```

2. Start Services:
   ```bash
   # Start MongoDB
   sudo systemctl start mongod
   sudo systemctl enable mongod

   # Start Redis
   sudo systemctl start redis
   sudo systemctl enable redis
   ```

### Backend Setup
---------------
1. Create and activate virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Initialize the models:
   ```bash
   python trigger.py
   ```

4. Start backend services:
   ```bash
   # Start the consumer in one terminal
   python consumer.py

   # Start the custom producer in another terminal
   streamlit run customproducer.py
   ```

### Frontend Setup
----------------
1. Navigate to Frontend directory:
   ```bash
   cd Frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

## Usage Guide
=============

### Real-time Monitoring
----------------------
1. Access Dashboard:
   - Open browser and navigate to http://localhost:5173
   - Login with credentials (if required)

2. Monitor Transactions:
   - View real-time transaction feed
   - Check fraud scores
   - Monitor system statistics
   - Analyze trends

3. Use Analysis Tools:
   - Apply filters
   - Search transactions
   - Export data
   - Generate reports

### Manual Transaction Testing
---------------------------
1. Access Streamlit Interface:
   - Open browser and navigate to http://localhost:8501
   - Login (if required)

2. Enter Transaction Details:
   - User ID
   - Amount
   - Merchant category
   - Device type
   - Additional metadata

3. View Results:
   - Real-time fraud prediction
   - Transaction history
   - User statistics

## API Documentation
==================

### REST Endpoints
----------------
1. Transaction Endpoints:
   ```
   GET /api/transactions
   - Query Parameters:
     * start_date: YYYY-MM-DD
     * end_date: YYYY-MM-DD
     * user_id: string
     * min_amount: number
     * max_amount: number
   - Response: JSON array of transactions
   ```

2. Statistics Endpoints:
   ```
   GET /api/stats
   - Response: JSON object with statistics
   ```

### WebSocket Events
------------------
1. Connection:
   ```
   Event: connect
   - Establishes real-time connection
   ```

2. Transaction Events:
   ```
   Event: newTransaction
   - Data: Transaction object
   ```

3. Status Events:
   ```
   Event: systemStatus
   - Data: System status object
   ```

## Model Training
===============

### Automatic Retraining
----------------------
1. Trigger Process:
   ```bash
   python trigger.py
   ```

2. Training Steps:
   - Load historical data
   - Preprocess features
   - Update user clusters
   - Train cluster models
   - Validate performance
   - Save updated models

### Manual Retraining
-------------------
1. Update Data:
   - Modify transactions.csv
   - Add new features
   - Update user mappings

2. Trigger Training:
   ```bash
   python trigger.py --force-retrain
   ```

3. Verify Results:
   - Check model performance
   - Validate predictions
   - Update documentation

## Performance Monitoring
=======================

### Key Metrics
-------------
1. Fraud Detection:
   - Detection rate
   - False positive rate
   - Precision and recall
   - F1 score

2. System Performance:
   - Transaction processing latency
   - Model prediction time
   - API response time
   - WebSocket latency

3. Resource Usage:
   - CPU utilization
   - Memory consumption
   - Database performance
   - Cache hit rate

### Monitoring Tools
------------------
1. Dashboard Metrics:
   - Real-time statistics
   - Performance graphs
   - System status
   - Error rates

2. Logging:
   - Application logs
   - Error logs
   - Performance logs
   - Security logs

## Security
==========

### Authentication
----------------
1. API Security:
   - JWT authentication
   - API key validation
   - Rate limiting
   - IP whitelisting

2. Data Security:
   - Data encryption
   - Secure storage
   - Access control
   - Audit logging

### Best Practices
----------------
1. Code Security:
   - Input validation
   - SQL injection prevention
   - XSS protection
   - CSRF protection

2. Infrastructure:
   - Firewall configuration
   - SSL/TLS encryption
   - Regular updates
   - Backup procedures

## Troubleshooting
=================

### Common Issues
---------------
1. MongoDB Connection:
   ```
   Error: Connection refused
   Solution:
   - Check MongoDB service status
   - Verify connection string
   - Check firewall settings
   ```

2. Redis Connection:
   ```
   Error: Connection timeout
   Solution:
   - Verify Redis service status
   - Check port availability
   - Validate connection parameters
   ```

3. Model Loading:
   ```
   Error: Model file not found
   Solution:
   - Check model directory
   - Verify file permissions
   - Re-run model training
   ```

4. Frontend Issues:
   ```
   Error: WebSocket connection failed
   Solution:
   - Check backend service
   - Verify network connectivity
   - Check firewall settings
   ```

### Debugging Tools
-----------------
1. Logging:
   - Application logs
   - Error logs
   - Performance logs
   - Security logs

2. Monitoring:
   - System metrics
   - Performance graphs
   - Error tracking
   - User analytics

## Contributing
=============

### Development Process
---------------------
1. Fork Repository:
   - Create feature branch
   - Follow coding standards
   - Write tests
   - Update documentation

2. Pull Request:
   - Describe changes
   - Include tests
   - Update documentation
   - Request review

### Code Standards
----------------
1. Python:
   - PEP 8 compliance
   - Type hints
   - Docstrings
   - Unit tests

2. TypeScript/React:
   - ESLint rules
   - TypeScript strict mode
   - Component documentation
   - Unit tests

### Documentation
---------------
1. Code Documentation:
   - Function documentation
   - Class documentation
   - API documentation
   - Setup instructions

2. User Documentation:
   - User guides
   - API reference
   - Troubleshooting
   - Best practices
