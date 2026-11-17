import json
import joblib
import numpy as np
import pandas as pd
import pytest
from backend.app.config import ARTIFACTS_DIR

def test_artifacts_exist():
    required_files = [
        "rf_classifier.joblib",
        "rf_regressor.joblib",
        "xgb_classifier.joblib",
        "xgb_regressor.joblib",
        "extractor.joblib",
        "metrics.json",
        "model_comparison.json",
        "feature_importance.json",
        "metadata.json",
        "stations_summary.json"
    ]
    for fname in required_files:
        p = ARTIFACTS_DIR / fname
        assert p.exists(), f"Missing required artifact: {fname}"

def test_models_prediction_sanity():
    rf_cls = joblib.load(ARTIFACTS_DIR / "rf_classifier.joblib")
    rf_reg = joblib.load(ARTIFACTS_DIR / "rf_regressor.joblib")
    xgb_cls = joblib.load(ARTIFACTS_DIR / "xgb_classifier.joblib")
    xgb_reg = joblib.load(ARTIFACTS_DIR / "xgb_regressor.joblib")
    extractor = joblib.load(ARTIFACTS_DIR / "extractor.joblib")

    # Sample point in Central Delhi
    df_sample = pd.DataFrame([{"lat": 28.6315, "long": 77.2167}])
    feats = extractor.transform(df_sample, is_training=False)

    # 1. RF Classifier
    rf_cls_pred = rf_cls.predict(feats)
    assert rf_cls_pred[0] in (0, 1, 2)
    rf_cls_prob = rf_cls.predict_proba(feats)[0]
    assert len(rf_cls_prob) == 3
    assert pytest.approx(sum(rf_cls_prob), abs=1e-4) == 1.0

    # 2. RF Regressor
    rf_reg_pred = rf_reg.predict(feats)
    assert 0.0 <= rf_reg_pred[0] <= 1.0

    # 3. XGB Classifier
    xgb_cls_pred = xgb_cls.predict(feats)
    assert xgb_cls_pred[0] in (0, 1, 2)
    xgb_cls_prob = xgb_cls.predict_proba(feats)[0]
    assert len(xgb_cls_prob) == 3
    assert pytest.approx(sum(xgb_cls_prob), abs=1e-4) == 1.0

    # 4. XGB Regressor
    xgb_reg_pred = xgb_reg.predict(feats)
    assert -0.2 <= xgb_reg_pred[0] <= 1.2

def test_metrics_integrity():
    with open(ARTIFACTS_DIR / "metrics.json", "r", encoding="utf-8") as f:
        metrics = json.load(f)

    # Classification metrics exist
    cls_rf = metrics["classification"]["random_forest"]
    cls_xgb = metrics["classification"]["xgboost"]
    cls_base = metrics["classification"]["baseline"]

    # Both RF and XGB must outperform dummy baseline in accuracy and F1
    assert cls_rf["accuracy"] > cls_base["accuracy"]
    assert cls_xgb["accuracy"] > cls_base["accuracy"]
    assert cls_rf["f1_macro"] > cls_base["f1_macro"]
    assert cls_xgb["f1_macro"] > cls_base["f1_macro"]

    # Regression metrics exist
    reg_rf = metrics["regression"]["random_forest"]
    reg_xgb = metrics["regression"]["xgboost"]
    reg_base = metrics["regression"]["baseline"]

    # Both models must beat dummy baseline in MAE, RMSE, and R2
    assert reg_rf["mae"] < reg_base["mae"]
    assert reg_xgb["mae"] < reg_base["mae"]
    assert reg_rf["rmse"] < reg_base["rmse"]
    assert reg_xgb["rmse"] < reg_base["rmse"]
    assert reg_rf["r2"] > reg_base["r2"]
    assert reg_xgb["r2"] > reg_base["r2"]

def test_feature_importance_validity():
    with open(ARTIFACTS_DIR / "feature_importance.json", "r", encoding="utf-8") as f:
        fi = json.load(f)

    assert "rf_classifier" in fi
    assert "xgb_classifier" in fi
    assert "rf_regressor" in fi
    assert "xgb_regressor" in fi

    # RF Classifier importances sum to 1.0
    rf_vals = list(fi["rf_classifier"].values())
    assert pytest.approx(sum(rf_vals), abs=1e-3) == 1.0

    # Top features should include station density and proximity
    top_feats = list(fi["rf_classifier"].keys())[:5]
    has_density_or_proximity = any("st" in feat or "dist" in feat for feat in top_feats)
    assert has_density_or_proximity is True
