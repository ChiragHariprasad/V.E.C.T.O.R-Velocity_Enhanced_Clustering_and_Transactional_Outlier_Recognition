"""
Bitcoin ML Model Training Pipeline
Reuses the V.E.C.T.O.R intelligence architecture (UMAP + HDBSCAN + Cluster-Specific Isolation Forest + XGBoost)
trained on Bitcoin behavioral feature vectors.
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest
import umap
import hdbscan
from xgboost import XGBClassifier
from bitcoin.config import MODEL_DIR, FEATURE_SCHEMA_VERSION
from bitcoin.schemas import BITCOIN_FEATURE_KEYS

def generate_synthetic_bitcoin_training_data(n_samples: int = 1200) -> pd.DataFrame:
    """Generate realistic Bitcoin behavioral feature matrix across 3 distinct behavioral communities."""
    np.random.seed(42)
    rows = []

    # Community 1: High-Frequency / Low-Value Transactions (Retail / Micropayments)
    for _ in range(n_samples // 3):
        row = {k: 0.0 for k in BITCOIN_FEATURE_KEYS}
        row["tx_count"] = float(np.random.randint(50, 500))
        row["avg_tx_value"] = float(np.random.uniform(0.001, 0.05))
        row["total_output_value"] = row["avg_tx_value"]
        row["tx_velocity_1h"] = float(np.random.randint(5, 25))
        row["tx_velocity_24h"] = row["tx_velocity_1h"] * 10
        row["unique_counterparties"] = float(np.random.randint(20, 150))
        row["degree"] = row["unique_counterparties"]
        row["pagerank"] = float(np.random.uniform(0.0001, 0.001))
        row["young_utxo_spending_ratio"] = float(np.random.uniform(0.6, 0.95))
        row["label"] = 0
        rows.append(row)

    # Community 2: Low-Frequency / High-Value Transactions (Whales / Cold Storage / Settlements)
    for _ in range(n_samples // 3):
        row = {k: 0.0 for k in BITCOIN_FEATURE_KEYS}
        row["tx_count"] = float(np.random.randint(2, 15))
        row["avg_tx_value"] = float(np.random.uniform(5.0, 150.0))
        row["total_output_value"] = row["avg_tx_value"]
        row["tx_velocity_1h"] = float(np.random.choice([0.0, 1.0]))
        row["tx_velocity_24h"] = float(np.random.uniform(0.1, 1.0))
        row["unique_counterparties"] = float(np.random.randint(1, 5))
        row["degree"] = row["unique_counterparties"]
        row["pagerank"] = float(np.random.uniform(0.001, 0.01))
        row["old_utxo_spending_ratio"] = float(np.random.uniform(0.7, 1.0))
        row["label"] = 0
        rows.append(row)

    # Community 3: Complex Aggregation & High-Velocity Dispersion (Mixers / Fast Layering Anomaly)
    for _ in range(n_samples // 3):
        row = {k: 0.0 for k in BITCOIN_FEATURE_KEYS}
        row["tx_count"] = float(np.random.randint(100, 1000))
        row["avg_tx_value"] = float(np.random.uniform(0.5, 10.0))
        row["total_output_value"] = row["avg_tx_value"]
        row["tx_velocity_1h"] = float(np.random.randint(20, 80))
        row["tx_velocity_24h"] = row["tx_velocity_1h"] * 15
        row["unique_counterparties"] = float(np.random.randint(100, 600))
        row["degree"] = row["unique_counterparties"]
        row["pagerank"] = float(np.random.uniform(0.005, 0.05))
        row["rapid_forwarding_score"] = float(np.random.uniform(0.7, 1.0))
        row["fan_out_score"] = float(np.random.uniform(0.6, 1.0))
        row["velocity_deviation"] = float(np.random.uniform(5.0, 25.0))
        row["label"] = 1  # Anomaly/Outlier flag
        rows.append(row)

    return pd.DataFrame(rows)

def train_bitcoin_models():
    """Train and persist Bitcoin UMAP, HDBSCAN, Cluster Isolation Forests, and Fallback XGBoost."""
    print("[V.E.C.T.O.R-BITCOIN] Initiating model training pipeline...")
    df = generate_synthetic_bitcoin_training_data(1500)
    X = df[BITCOIN_FEATURE_KEYS].values
    y = df["label"].values

    # 1. Global Scaler
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    joblib.dump(scaler, os.path.join(MODEL_DIR, "bitcoin_scaler.joblib"))

    # 2. UMAP Dimensionality Reduction
    print("[*] Running UMAP on Bitcoin behavioral vectors...")
    reducer = umap.UMAP(n_neighbors=15, min_dist=0.1, n_components=5, random_state=42)
    X_umap = reducer.fit_transform(X_scaled)
    joblib.dump(reducer, os.path.join(MODEL_DIR, "bitcoin_umap.joblib"))

    # 3. HDBSCAN Community Discovery
    print("[*] Discovering behavioral communities via HDBSCAN...")
    clusterer = hdbscan.HDBSCAN(min_cluster_size=20, min_samples=10, prediction_data=True)
    cluster_labels = clusterer.fit_predict(X_umap)
    joblib.dump(clusterer, os.path.join(MODEL_DIR, "bitcoin_hdbscan.joblib"))

    unique_clusters = set(cluster_labels)
    print(f"[+] Discovered {len(unique_clusters)} behavioral clusters (labels: {unique_clusters})")

    # 4. Train Cluster-Specific Isolation Forests
    cluster_descriptions = {}
    for cluster_id in unique_clusters:
        if cluster_id == -1:
            continue
        mask = (cluster_labels == cluster_id)
        X_cluster = X_scaled[mask]
        
        iso_forest = IsolationForest(contamination=0.08, random_state=42)
        iso_forest.fit(X_cluster)
        
        # Decision function score bounds
        scores = iso_forest.decision_function(X_cluster)
        score_min, score_max = float(np.min(scores)), float(np.max(scores))

        bundle = (iso_forest, scaler, score_min, score_max)
        bundle_path = os.path.join(MODEL_DIR, f"bitcoin_cluster_{cluster_id}_bundle.pkl")
        joblib.dump(bundle, bundle_path)

        # Profile description
        mean_vol = float(np.mean(X[mask][:, BITCOIN_FEATURE_KEYS.index("avg_tx_value")]))
        mean_vel = float(np.mean(X[mask][:, BITCOIN_FEATURE_KEYS.index("tx_velocity_1h")]))
        desc = f"Cluster {cluster_id}: Avg Vol {mean_vol:.3f} BTC, Avg Velocity {mean_vel:.1f} tx/hr"
        cluster_descriptions[str(cluster_id)] = {
            "cluster_id": int(cluster_id),
            "size": int(np.sum(mask)),
            "description": desc,
            "avg_volume": round(mean_vol, 4),
            "avg_velocity": round(mean_vel, 2)
        }

    with open(os.path.join(MODEL_DIR, "bitcoin_cluster_metadata.json"), "w") as f:
        json.dump(cluster_descriptions, f, indent=4)

    # 5. Fallback XGBoost Model for Cold-Start / Sparse Entities
    print("[*] Training XGBoost fallback model for cold-start entities...")
    xgb_model = XGBClassifier(n_estimators=100, max_depth=4, learning_rate=0.08, random_state=42)
    xgb_model.fit(X_scaled, y)
    joblib.dump(xgb_model, os.path.join(MODEL_DIR, "bitcoin_fallback_xgboost.joblib"))

    # 6. Save Metadata
    metadata = {
        "model_version": "bitcoin_v1",
        "feature_schema_version": FEATURE_SCHEMA_VERSION,
        "features_count": len(BITCOIN_FEATURE_KEYS),
        "training_samples": len(df),
        "clusters_discovered": len(unique_clusters),
        "status": "ready"
    }
    with open(os.path.join(MODEL_DIR, "model_metadata.json"), "w") as f:
        json.dump(metadata, f, indent=4)

    print("[+] [V.E.C.T.O.R-BITCOIN] All models trained and persisted successfully!")

if __name__ == "__main__":
    train_bitcoin_models()
