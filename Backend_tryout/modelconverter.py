# modelconverter.py
import os
import joblib
import numpy as np
from onnxmltools.convert import convert_xgboost
from onnxmltools.convert.common.data_types import FloatTensorType
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType as SKLFloatTensorType
import feature_engineering

model_dir = "cluster_models"
onnx_dir = "onnx_models"
os.makedirs(onnx_dir, exist_ok=True)
features = feature_engineering.FEATURE_KEYS
n_features = len(features)

def export_xgboost_model(model_path, output_name):
    from xgboost import Booster, XGBClassifier

    model = joblib.load(model_path)

    if isinstance(model, XGBClassifier):
        booster = model.get_booster()
    elif isinstance(model, Booster):
        booster = model
    else:
        raise ValueError("Unsupported fallback model format")

    initial_type = [('input', FloatTensorType([None, n_features]))]
    onnx_model = convert_xgboost(booster, initial_types=initial_type)
    with open(os.path.join(onnx_dir, output_name), "wb") as f:
        f.write(onnx_model.SerializeToString())

def export_sklearn_model(model_bundle_path, output_name):
    model_bundle = joblib.load(model_bundle_path)
    model, scaler, *_ = model_bundle
    initial_type = [('input', SKLFloatTensorType([None, n_features]))]

    # 🔥 Force ai.onnx.ml opset version to v3 using domain_opset
    onnx_model = convert_sklearn(
        model,
        initial_types=initial_type,
        target_opset=13,
        options={"zipmap": False},
        domain_opset={'ai.onnx.ml': 3}
    )

    with open(os.path.join(onnx_dir, output_name), "wb") as f:
        f.write(onnx_model.SerializeToString())


# Export fallback model (XGBoost)
export_xgboost_model("cluster_models/fallback_xgboost_model.joblib", "fallback_model.onnx")

# Export all sklearn-based cluster models
for f in os.listdir(model_dir):
    if f.startswith("cluster_") and f.endswith("_bundle.pkl"):
        cluster_id = f.split("_")[1]
        try:
            export_sklearn_model(os.path.join(model_dir, f), f"cluster_{cluster_id}.onnx")
        except Exception as e:
            print(f"⚠️ Failed to convert cluster_{cluster_id}: {e}")
