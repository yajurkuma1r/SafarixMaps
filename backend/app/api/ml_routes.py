import json
from pathlib import Path
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import ARTIFACTS_DIR
from ..ml.inference import RiskInferenceEngine

router = APIRouter(prefix="/api/ml", tags=["ML Model Management & Metrics"])

class ModelSelectRequest(BaseModel):
    model: str  # 'rf' or 'xgb'

class ModelSelectResponse(BaseModel):
    active_model: str
    message: str

@router.get("/info")
async def get_ml_info() -> Dict[str, Any]:
    """
    Returns active ML model status, available models, features, and training metadata.
    """
    engine = RiskInferenceEngine.get_instance()
    meta_path = ARTIFACTS_DIR / "metadata.json"
    metadata = {}
    if meta_path.exists():
        with open(meta_path, "r", encoding="utf-8") as f:
            metadata = json.load(f)

    return {
        "status": "ready" if engine.is_loaded else "uninitialized",
        "active_model": engine.active_model_name,
        "available_models": ["rf (Random Forest)", "xgb (XGBoost)"],
        "metadata": metadata
    }

@router.get("/metrics")
async def get_evaluation_metrics() -> Dict[str, Any]:
    """
    Returns full evaluation metrics for Random Forest and XGBoost across classification and regression,
    including accuracy, precision, recall, F1, confusion matrices, and baseline comparisons.
    """
    metrics_path = ARTIFACTS_DIR / "metrics.json"
    if not metrics_path.exists():
        raise HTTPException(status_code=404, detail="Metrics artifact not found. Please train models first.")
    with open(metrics_path, "r", encoding="utf-8") as f:
        return json.load(f)

@router.get("/comparison")
async def get_model_comparison() -> Dict[str, Any]:
    """
    Returns comparative evaluation analysis between Random Forest and XGBoost,
    highlighting recall on high-risk areas, cross-validation stability, and production suitability.
    """
    comp_path = ARTIFACTS_DIR / "model_comparison.json"
    if not comp_path.exists():
        raise HTTPException(status_code=404, detail="Model comparison artifact not found.")
    with open(comp_path, "r", encoding="utf-8") as f:
        return json.load(f)

@router.get("/feature-importance")
async def get_feature_importances() -> Dict[str, Any]:
    """
    Returns spatial feature importance rankings for both Random Forest and XGBoost models.
    """
    fi_path = ARTIFACTS_DIR / "feature_importance.json"
    if not fi_path.exists():
        raise HTTPException(status_code=404, detail="Feature importance artifact not found.")
    with open(fi_path, "r", encoding="utf-8") as f:
        return json.load(f)

@router.post("/select-model", response_model=ModelSelectResponse)
async def select_active_model(payload: ModelSelectRequest):
    """
    Dynamically select the active inference model ('rf' or 'xgb').
    """
    engine = RiskInferenceEngine.get_instance()
    success = engine.set_active_model(payload.model)
    if not success:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid model '{payload.model}'. Supported options: 'rf', 'xgb'."
        )
    return ModelSelectResponse(
        active_model=engine.active_model_name,
        message=f"Active ML model switched to '{engine.active_model_name}' successfully."
    )
