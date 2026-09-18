"""
Bitcoin ML Inference Engine
Implements the multi-stage V.E.C.T.O.R intelligence architecture:
Feature Vector (66D) -> StandardScaler -> UMAP -> HDBSCAN Clustering ->
Cluster-Specific Isolation Forest -> XGBoost Fallback (for sparse/cold-start) -> ML Anomaly Score.

Explicitly returns ML_UNAVAILABLE if models cannot run, preventing silent heuristic fallbacks.
"""

import os
import glob
import json
import logging
import time
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import joblib

try:
    import hdbscan
    HAS_HDBSCAN = True
except ImportError:
    HAS_HDBSCAN = False

from bitcoin.config import MODEL_DIR
from bitcoin.schemas import BITCOIN_FEATURE_KEYS

logger = logging.getLogger("VECTOR.MLInference")

# Explicit error state constant
ML_UNAVAILABLE = "ML_UNAVAILABLE"


class BitcoinMLInferenceEngine:
    """
    Production inference engine for Bitcoin behavioral outlier and anomaly detection.
    Encapsulates model loading, feature validation, dimensionality reduction,
    density-based cluster routing, cluster Isolation Forest inference, and XGBoost fallback.
    """

    def __init__(self, model_dir: str = MODEL_DIR):
        self.model_dir = model_dir
        self.is_operational: bool = False
        self.model_version: str = "unknown"
        self.feature_schema_version: str = "unknown"
        self.expected_features_count: int = len(BITCOIN_FEATURE_KEYS)

        self.scaler = None
        self.umap_model = None
        self.clusterer = None
        self.xgb_fallback = None
        self.cluster_bundles: Dict[int, Tuple[Any, Any, float, float]] = {}
        self.cluster_metadata: Dict[str, Any] = {}

        # Latency instrumentation & telemetry tracking
        self._loaded_at: Optional[str] = None
        self._latency_history: List[float] = []
        self._pre_latencies: List[float] = []
        self._inf_latencies: List[float] = []
        self._post_latencies: List[float] = []
        self._total_inferences: int = 0

        self._load_models()

    def _load_models(self) -> None:
        """Load all serialized models and metadata from disk."""
        try:
            # 1. Check directory existence
            if not os.path.exists(self.model_dir):
                logger.warning(f"Model directory does not exist: {self.model_dir}")
                self.is_operational = False
                return

            # 2. Load model metadata
            meta_path = os.path.join(self.model_dir, "model_metadata.json")
            if os.path.exists(meta_path):
                with open(meta_path, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                    self.model_version = meta.get("model_version", "bitcoin_v1")
                    self.feature_schema_version = meta.get("feature_schema_version", "bitcoin_features_v1")
                    self.expected_features_count = meta.get("features_count", len(BITCOIN_FEATURE_KEYS))

            # 3. Load Cluster Descriptions
            cluster_meta_path = os.path.join(self.model_dir, "bitcoin_cluster_metadata.json")
            if os.path.exists(cluster_meta_path):
                with open(cluster_meta_path, "r", encoding="utf-8") as f:
                    self.cluster_metadata = json.load(f)

            # 4. Load Scaler
            scaler_path = os.path.join(self.model_dir, "bitcoin_scaler.joblib")
            if not os.path.exists(scaler_path):
                logger.warning(f"Global scaler not found at {scaler_path}")
                self.is_operational = False
                return
            self.scaler = joblib.load(scaler_path)

            # 5. Load UMAP
            umap_path = os.path.join(self.model_dir, "bitcoin_umap.joblib")
            if os.path.exists(umap_path):
                self.umap_model = joblib.load(umap_path)

            # 6. Load HDBSCAN
            hdbscan_path = os.path.join(self.model_dir, "bitcoin_hdbscan.joblib")
            if os.path.exists(hdbscan_path):
                self.clusterer = joblib.load(hdbscan_path)

            # 7. Load Fallback XGBoost
            xgb_path = os.path.join(self.model_dir, "bitcoin_fallback_xgboost.joblib")
            if not os.path.exists(xgb_path):
                logger.warning(f"Fallback XGBoost model not found at {xgb_path}")
                self.is_operational = False
                return
            self.xgb_fallback = joblib.load(xgb_path)

            # 8. Load Cluster-Specific Isolation Forest Bundles
            bundle_pattern = os.path.join(self.model_dir, "bitcoin_cluster_*_bundle.pkl")
            for b_file in glob.glob(bundle_pattern):
                try:
                    filename = os.path.basename(b_file)
                    # format: bitcoin_cluster_{id}_bundle.pkl
                    cid_str = filename.replace("bitcoin_cluster_", "").replace("_bundle.pkl", "")
                    cid = int(cid_str)
                    bundle = joblib.load(b_file)
                    # bundle structure: (iso_forest, scaler, score_min, score_max)
                    self.cluster_bundles[cid] = bundle
                except Exception as e:
                    logger.warning(f"Failed loading cluster bundle {b_file}: {e}")

            self.is_operational = True
            self._loaded_at = datetime.now(timezone.utc).isoformat()
            logger.info(
                f"Bitcoin ML Inference Engine initialized successfully: version={self.model_version}, "
                f"clusters_loaded={list(self.cluster_bundles.keys())}, fallback_xgb=True"
            )

        except Exception as e:
            logger.error(f"Error during ML model loading: {e}", exc_info=True)
            self.is_operational = False

    def validate_feature_vector(self, features: Any) -> np.ndarray:
        """
        Validate and convert features into a 2D NumPy array of shape (1, 66).
        Raises ValueError if dimensions are invalid.
        """
        if isinstance(features, dict):
            vec = [float(features.get(k, 0.0)) for k in BITCOIN_FEATURE_KEYS]
            arr = np.array(vec, dtype=float).reshape(1, -1)
        elif isinstance(features, (list, tuple)):
            arr = np.array(features, dtype=float).reshape(1, -1)
        elif isinstance(features, np.ndarray):
            arr = features.reshape(1, -1) if features.ndim == 1 else features
        else:
            raise ValueError(f"Unsupported features type: {type(features)}")

        if arr.shape[1] != self.expected_features_count:
            raise ValueError(
                f"Feature dimension mismatch: expected {self.expected_features_count} columns, "
                f"got {arr.shape[1]}"
            )

        # Replace NaNs / Infs with 0.0
        if np.isnan(arr).any() or np.isinf(arr).any():
            arr = np.nan_to_num(arr, nan=0.0, posinf=0.0, neginf=0.0)

        return arr

    def predict(
        self,
        features: Any,
        is_cold_start: bool = False
    ) -> Dict[str, Any]:
        """
        Execute full analytical inference over the given entity/transaction features:
        1. Feature validation & preprocessing (StandardScaler)
        2. UMAP dimensionality reduction
        3. HDBSCAN behavioral community discovery
        4. Cluster-Specific Isolation Forest scoring
        5. XGBoost fallback if sparse/cold-start or unassigned/noise

        Returns:
            Dict containing:
                ml_score: float in [0.0, 1.0] or None if unavailable
                model_type: str descriptive model name or "ML_UNAVAILABLE"
                cluster_id: int cluster ID, -1 (noise), or None
                cluster_probability: float
                model_version: str
                status: "SUCCESS" or "ML_UNAVAILABLE"
                latency_ms: float measured elapsed inference time
        """
        if not self.is_operational:
            return {
                "ml_score": None,
                "model_type": ML_UNAVAILABLE,
                "cluster_id": None,
                "cluster_probability": 0.0,
                "model_version": self.model_version,
                "status": ML_UNAVAILABLE,
                "latency_ms": None,
                "error": "ML models not loaded or operational"
            }

        t0 = time.perf_counter()
        try:
            # Stage 1: Preprocessing & Scaling
            X = self.validate_feature_vector(features)
            X_scaled = self.scaler.transform(X)
            t1 = time.perf_counter()
            pre_ms = (t1 - t0) * 1000

            # If cold-start entity (e.g. 1st or 2nd transaction), route directly to XGBoost fallback
            if is_cold_start:
                prob = float(self.xgb_fallback.predict_proba(X_scaled)[0][1])
                t2 = time.perf_counter()
                inf_ms = (t2 - t1) * 1000
                post_ms = 0.05
                total_ms = (t2 - t0) * 1000
                self._record_latency(pre_ms, inf_ms, post_ms, total_ms)
                return {
                    "ml_score": round(prob, 4),
                    "model_type": "xgboost_cold_start",
                    "cluster_id": None,
                    "cluster_probability": 0.0,
                    "model_version": self.model_version,
                    "status": "SUCCESS",
                    "latency_ms": round(total_ms, 3)
                }

            # Behavioral Clustering via UMAP + HDBSCAN
            cluster_id = -1
            cluster_prob = 0.0

            if self.umap_model is not None and self.clusterer is not None and HAS_HDBSCAN:
                try:
                    X_umap = self.umap_model.transform(X_scaled)
                    labels, probs = hdbscan.approximate_predict(self.clusterer, X_umap)
                    cluster_id = int(labels[0])
                    cluster_prob = float(probs[0])
                except Exception as ce:
                    logger.debug(f"UMAP/HDBSCAN approximate predict skipped: {ce}")
                    cluster_id = -1

            t_inf_start = time.perf_counter()
            # Route 1: Assigned to a known cluster with an Isolation Forest bundle
            if cluster_id in self.cluster_bundles:
                iso_forest, _, score_min, score_max = self.cluster_bundles[cluster_id]
                # Decision function: lower values mean more abnormal
                raw_score = float(iso_forest.decision_function(X_scaled)[0])
                t2 = time.perf_counter()
                inf_ms = (t2 - t_inf_start) * 1000

                # Calibrate to [0, 1] anomaly score where 1 = highest anomaly
                t_post_start = time.perf_counter()
                if score_max > score_min:
                    normalized_anomaly = (score_max - raw_score) / (score_max - score_min)
                    anomaly_score = max(0.0, min(1.0, float(normalized_anomaly)))
                else:
                    anomaly_score = 0.5 if raw_score < 0 else 0.1
                t3 = time.perf_counter()
                post_ms = (t3 - t_post_start) * 1000
                total_ms = (t3 - t0) * 1000
                self._record_latency(pre_ms, inf_ms, post_ms, total_ms)

                timing_breakdown = {
                    "preprocessing_ms": round(pre_ms, 3),
                    "inference_ms": round(inf_ms, 3),
                    "postprocessing_ms": round(post_ms, 3),
                    "total_ms": round(total_ms, 3)
                }

                return {
                    "ml_score": round(anomaly_score, 4),
                    "model_type": f"isolation_forest_cluster_{cluster_id}",
                    "cluster_id": cluster_id,
                    "cluster_probability": round(cluster_prob, 4),
                    "model_version": self.model_version,
                    "status": "SUCCESS",
                    "latency_ms": round(total_ms, 3),
                    "timing_breakdown_ms": timing_breakdown,
                    "inference_timing_ms": timing_breakdown
                }

            # Route 2: Noise (-1), unassigned, or bundle missing -> Fallback XGBoost
            prob = float(self.xgb_fallback.predict_proba(X_scaled)[0][1])
            t2 = time.perf_counter()
            inf_ms = (t2 - t_inf_start) * 1000
            post_ms = 0.05
            total_ms = (t2 - t0) * 1000
            self._record_latency(pre_ms, inf_ms, post_ms, total_ms)

            timing_breakdown = {
                "preprocessing_ms": round(pre_ms, 3),
                "inference_ms": round(inf_ms, 3),
                "postprocessing_ms": round(post_ms, 3),
                "total_ms": round(total_ms, 3)
            }

            return {
                "ml_score": round(prob, 4),
                "model_type": "xgboost_fallback",
                "cluster_id": cluster_id if cluster_id != -1 else None,
                "cluster_probability": round(cluster_prob, 4),
                "model_version": self.model_version,
                "status": "SUCCESS",
                "latency_ms": round(total_ms, 3),
                "timing_breakdown_ms": timing_breakdown,
                "inference_timing_ms": timing_breakdown
            }

        except Exception as e:
            logger.error(f"Inference execution failed: {e}", exc_info=True)
            return {
                "ml_score": None,
                "model_type": ML_UNAVAILABLE,
                "cluster_id": None,
                "cluster_probability": 0.0,
                "model_version": self.model_version,
                "status": ML_UNAVAILABLE,
                "latency_ms": None,
                "error": str(e)
            }

    def _record_latency(self, pre_ms: float, inf_ms: float, post_ms: float, total_ms: float) -> None:
        """Record inference timing samples in running sliding window."""
        self._total_inferences += 1
        self._latency_history.append(total_ms)
        self._pre_latencies.append(pre_ms)
        self._inf_latencies.append(inf_ms)
        self._post_latencies.append(post_ms)
        if len(self._latency_history) > 1000:
            self._latency_history.pop(0)
            self._pre_latencies.pop(0)
            self._inf_latencies.pop(0)
            self._post_latencies.pop(0)

    def get_model_status(self) -> Dict[str, Any]:
        """Derive actual runtime model state without fictional defaults."""
        scaler_path = os.path.join(self.model_dir, "bitcoin_scaler.joblib") if self.model_dir else ""
        if not self.model_dir or not os.path.exists(self.model_dir) or not os.path.exists(scaler_path):
            return {
                "status": "MODEL_MISSING",
                "name": "V.E.C.T.O.R Multi-Model Behavioral Anomaly Detector",
                "version": self.model_version,
                "loaded_at": None,
                "features_count": self.expected_features_count,
                "clusters_loaded": [],
                "fallback_model": None,
                "error": f"Model artifacts missing from {self.model_dir}"
            }
        if not self.is_operational:
            return {
                "status": "MODEL_ERROR",
                "name": "V.E.C.T.O.R Multi-Model Behavioral Anomaly Detector",
                "version": self.model_version,
                "loaded_at": None,
                "features_count": self.expected_features_count,
                "clusters_loaded": [],
                "fallback_model": None,
                "error": "Models failed to load properly"
            }
        return {
            "status": "OPERATIONAL",
            "name": "V.E.C.T.O.R Multi-Model Behavioral Anomaly Detector",
            "version": self.model_version,
            "loaded_at": self._loaded_at,
            "features_count": self.expected_features_count,
            "clusters_loaded": sorted(list(self.cluster_bundles.keys())),
            "fallback_model": "xgboost" if self.xgb_fallback is not None else None,
            "error": None
        }

    def get_telemetry(self) -> Dict[str, Any]:
        """Return combined model metadata and actual measured latency distribution."""
        status = self.get_model_status()
        if not self._latency_history:
            latency_info = {
                "status": "unmeasured",
                "latency_ms": None,
                "avg_latency_ms": None,
                "p95_latency_ms": None,
                "sample_count": 0,
                "breakdown": None
            }
        else:
            lats = self._latency_history
            p95 = float(np.percentile(lats, 95)) if len(lats) >= 5 else float(np.max(lats))
            latency_info = {
                "status": "measured",
                "latency_ms": round(lats[-1], 3),
                "avg_latency_ms": round(float(np.mean(lats)), 3),
                "p95_latency_ms": round(p95, 3),
                "sample_count": len(lats),
                "total_inferences": self._total_inferences,
                "breakdown": {
                    "preprocessing_ms": round(float(np.mean(self._pre_latencies)), 3) if self._pre_latencies else 0.0,
                    "inference_ms": round(float(np.mean(self._inf_latencies)), 3) if self._inf_latencies else 0.0,
                    "postprocessing_ms": round(float(np.mean(self._post_latencies)), 3) if self._post_latencies else 0.0,
                }
            }
        return {
            "model": status,
            "inference": latency_info
        }

    def get_cluster_metadata(self) -> Dict[str, Any]:
        """Return loaded cluster profile metadata."""
        return self.cluster_metadata
