### 📁 **Repository Root Structure**

```
V.E.C.T.O.R/
├── Backend/
│ ├── consumer.py
│ ├── trigger.py
│ ├── producer.py
│ ├── customproducer.py
│ ├── cluster_models/
│ ├── transactions.csv
│ ├── fraud_scores_by_cluster.csv
│ ├── user_feature_data.json
│ └── user_cluster_mapping.json
│
├── Frontend/
│ ├── src/
│ │ ├── components/
│ │ ├── context/
│ │ ├── pages/
│ │ ├── types/
│ │ ├── App.tsx
│ │ ├── main.tsx
│ │ └── socket.ts
│ ├── public/
│ ├── package.json
│ ├── tsconfig.json
│ └── vite.config.ts

```

---

# V.E.C.T.O.R: Real-Time System for Velocity-Enhanced Clustering and Transactional Outlier Recognition in Financial Fraud Detection

### Patent Metadata
**Application No:** 202541077457  
**Publication Date:** 3 October 2025  
**Applicant:** RV College of Engineering  
**Inventors:** Dr. B. Sathish Babu, Chirag Hariprasad, Manoj Malipatil, Dhanush Moolemane, Hema Umesh Hegde, Affan Yasir  
**Jurisdiction:** The Patents Act, 1970 (India)  

> ⚠️ *Protected intellectual property. Viewing is permitted. Copying or derivative work without authorization is prohibited.*

---

## Table of Contents
1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Technical Stack](#technical-stack)
4. [Model Architecture](#model-architecture)
5. [Directory Structure](#directory-structure)
6. [Transaction Flow](#transaction-flow)
7. [Mathematical Concepts](#mathematical-concepts)
8. [Setup Guide](#setup-guide)
9. [Usage Instructions](#usage-instructions)
10. [API Specification](#api-specification)
11. [Model Training](#model-training)
12. [Performance Monitoring](#performance-monitoring)
13. [Security Framework](#security-framework)
14. [Troubleshooting](#troubleshooting)
15. [Legal Notice](#legal-notice)

---

## Overview
**V.E.C.T.O.R** is a patented real-time fraud intelligence platform designed for financial systems.  
It merges machine learning, velocity-based clustering, and data-driven anomaly detection to identify high-risk transactions in real time.

**Core Objectives**
- Real-time anomaly recognition  
- Adaptive behavioral clustering  
- Hybrid ML integration  
- Transparent fraud intelligence dashboard  

**Key Features**
- Fraud scoring and user profiling  
- Streaming-based fraud detection pipeline  
- Real-time visualization dashboard  
- Modular data ingestion and analysis architecture  

---

## System Architecture

### Backend Layers
| Layer | Description |
|-------|--------------|
| **Data Producers** | Generate or stream incoming transactions. |
| **Data Consumers** | Core ML engine performing feature extraction and fraud inference. |
| **Model Manager** | Handles training, clustering, and model versioning. |
| **Databases** | MongoDB and Redis for persistence and caching. |
| **Storage Layer** | Retains metrics and non-sensitive logs for audits. |

---

### Frontend Layers
- Built using **React + TypeScript**  
- Data updates via **WebSocket streams**  
- Visual stack: **Chart.js**, **TailwindCSS**, **Framer Motion**  
- Responsive single-page dashboard for fraud analysis  

---

## Technical Stack

### Backend
- **Language:** Python 3.x  
- **Libraries:** `scikit-learn`, `xgboost`, `hdbscan`, `umap-learn`, `redis`, `pymongo`, `streamlit`  
- **Databases:** MongoDB (6.0+), Redis (7.0+)

### Frontend
- **Framework:** React 18 + TypeScript 5  
- **Dependencies:** `chart.js`, `socket.io-client`, `framer-motion`, `axios`, `lucide-react`, `tailwindcss`  

---

## Model Architecture

### User Clustering
- Algorithm: **HDBSCAN**  
- Input: User behavioral feature matrix  
- Output: Cluster assignments for adaptive fraud thresholds  

### Fraud Detection
- Cluster-specific model: **Isolation Forest**  
- Fallback model: **XGBoost**  
- Combined result: Weighted fraud confidence score  

### Feature Pipeline
- **Static Features:** demographic and device metadata  
- **Dynamic Features:** transaction velocity, periodicity, and anomaly deviation  

---


## Transaction Flow
```

[Producer/API] → [Redis Stream] → [Consumer Engine]
→ [Feature Engineering] → [Model Prediction]
→ [MongoDB] → [WebSocket Broadcast] → [Frontend Dashboard]

````

- **Feature extraction:** Real-time velocity & behavioral vectorization  
- **Model mapping:** Cluster-specific models allocated dynamically  
- **Prediction output:** Fraud score visualization on live dashboard  

---

## Mathematical Concepts
*(Public-safe redaction applied to proprietary formulations)*

1. **Velocity Computation:** `V = n / Δt`  
2. **Anomaly Scoring:** Based on path length deviation  
3. **Cluster Density:** Euclidean-based neighborhood measure  
4. **Model Metrics:** Precision, Recall, F1, ROC-AUC  

---
## API Specification

| Method | Route               | Description                      |
| ------ | ------------------- | -------------------------------- |
| `GET`  | `/api/transactions` | Retrieve transaction data        |
| `GET`  | `/api/stats`        | System-level performance metrics |
| `WS`   | `newTransaction`    | Real-time transaction events     |
| `WS`   | `systemStatus`      | Backend status updates           |

---

## Model Training

### Automatic Retraining

```bash
python trigger.py
```

Updates clustering and re-trains models.

### Manual Retraining

```bash
python trigger.py --force-retrain
```

For forced full-model refresh after data updates.

---

## Performance Monitoring

**Metrics**

* Latency (ms)
* Throughput (transactions/sec)
* Cache Hit Ratio
* Fraud detection precision/recall

**Monitoring Tools**

* Real-time dashboard charts
* Performance and error logs

---

## Troubleshooting

| Issue              | Root Cause          | Fix                                 |
| ------------------ | ------------------- | ----------------------------------- |
| MongoDB error      | Service not running | `sudo systemctl start mongod`       |
| Redis timeout      | Port conflict       | Restart Redis (port 6379)           |
| Model load failure | Missing file        | Run `trigger.py`                    |
| WebSocket error    | Network issue       | Validate backend port accessibility |

---

## Legal Notice

```
© 2025 RV College of Engineering and the listed inventors.
Patent Application No: 202541077457 | Published: 3 October 2025

This repository provides a redacted, non-functional demonstration
of the patented V.E.C.T.O.R system for educational and evaluative purposes.

No license is granted for reproduction, modification, or derivative use.
Any unauthorized use constitutes infringement under Indian patent law.
```
