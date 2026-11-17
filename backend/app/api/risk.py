from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ..ml.inference import RiskInferenceEngine

router = APIRouter(prefix="/api/risk", tags=["Risk Analysis & ML"])

class CoordinatesRequest(BaseModel):
    coordinates: List[List[float]] = Field(
        ...,
        description="Array of [longitude, latitude] pairs along the route (GeoJSON / MapLibre format)"
    )
    model: Optional[str] = Field(
        None,
        description="Optional model override ('rf', 'xgb', or 'random_forest', 'xgboost')"
    )

class SegmentRiskModel(BaseModel):
    start_index: int
    end_index: int
    risk_score: float
    risk_level: str
    crime_count: int

class RouteRiskResponseModel(BaseModel):
    segments: List[SegmentRiskModel]
    overall_risk: float
    total_crimes_nearby: int
    incident_breakdown: Optional[Dict[str, int]] = None
    model_used: Optional[str] = None

class PointRiskRequest(BaseModel):
    latitude: float
    longitude: float
    model: Optional[str] = None

class PointRiskResponse(BaseModel):
    risk_score: float
    risk_level: str
    probabilities: Dict[str, float]
    model_used: str
    nearest_station: str
    distance_km: float
    is_delhi_region: bool

class CrimePointModel(BaseModel):
    latitude: float
    longitude: float
    severity: float

@router.post("/analyze", response_model=RouteRiskResponseModel)
async def analyze_route_risk(payload: CoordinatesRequest):
    """
    Analyze risk along a navigation route using trained Machine Learning models (Random Forest / XGBoost).
    Directly fulfills the frontend contract in SafarixMaps lib/riskApi.ts.
    """
    if not payload.coordinates:
        raise HTTPException(status_code=400, detail="Coordinates array must not be empty")

    engine = RiskInferenceEngine.get_instance()
    result = engine.analyze_route(payload.coordinates, model_name=payload.model)

    return RouteRiskResponseModel(
        segments=[
            SegmentRiskModel(
                start_index=s["start_index"],
                end_index=s["end_index"],
                risk_score=s["risk_score"],
                risk_level=s["risk_level"],
                crime_count=s.get("crime_count", 0)
            )
            for s in result["segments"]
        ],
        overall_risk=result["overall_risk"],
        total_crimes_nearby=result["total_crimes_nearby"],
        incident_breakdown=result.get("incident_breakdown"),
        model_used=result.get("model_used")
    )

@router.get("/crimes", response_model=List[CrimePointModel])
async def get_crime_points():
    """
    Returns spatial crime points with scaled severity (1.0 - 10.0) for MapLibre GL Heatmap rendering.
    Directly fulfills the frontend contract in SafarixMaps components/map/MapView.tsx.
    """
    engine = RiskInferenceEngine.get_instance()
    points = engine.get_crime_points_for_heatmap()
    return [
        CrimePointModel(
            latitude=p["latitude"],
            longitude=p["longitude"],
            severity=p["severity"]
        )
        for p in points
    ]

@router.post("/predict", response_model=PointRiskResponse)
async def predict_point_risk(payload: PointRiskRequest):
    """
    Predict real-time ML crime risk score and discrete risk category for any geographic coordinate.
    """
    engine = RiskInferenceEngine.get_instance()
    result = engine.predict_coordinate_risk(
        lat=payload.latitude,
        lon=payload.longitude,
        model_name=payload.model
    )
    return PointRiskResponse(**result)
