import pytest
from backend.app.ml.inference import RiskInferenceEngine

def test_inference_singleton():
    eng1 = RiskInferenceEngine.get_instance()
    eng2 = RiskInferenceEngine.get_instance()
    assert eng1 is eng2
    assert eng1.is_loaded is True

def test_model_switching():
    engine = RiskInferenceEngine.get_instance()
    assert engine.set_active_model("xgb") is True
    assert engine.active_model_name == "xgb"
    assert engine.set_active_model("rf") is True
    assert engine.active_model_name == "rf"
    assert engine.set_active_model("invalid_model") is False

def test_predict_single_point():
    engine = RiskInferenceEngine.get_instance()
    # Test Central Delhi
    res_rf = engine.predict_coordinate_risk(28.6315, 77.2167, model_name="rf")
    assert 0.0 <= res_rf["risk_score"] <= 1.0
    assert res_rf["risk_level"] in ("low", "medium", "high")
    assert res_rf["model_used"] == "random_forest"
    assert res_rf["is_delhi_region"] is True
    assert res_rf["distance_km"] >= 0.0

    # Test with XGBoost
    res_xgb = engine.predict_coordinate_risk(28.6315, 77.2167, model_name="xgb")
    assert 0.0 <= res_xgb["risk_score"] <= 1.0
    assert res_xgb["risk_level"] in ("low", "medium", "high")
    assert res_xgb["model_used"] == "xgboost"

def test_route_analysis_comprehensive():
    engine = RiskInferenceEngine.get_instance()
    # 20 waypoint route across Delhi (from Rohini to Central Delhi)
    lats = list(map(float, [28.71, 28.70, 28.69, 28.68, 28.67, 28.66, 28.65, 28.64, 28.63]))
    lons = list(map(float, [77.12, 77.13, 77.14, 77.15, 77.16, 77.17, 77.18, 77.19, 77.21]))
    route_coords = [[lon, lat] for lon, lat in zip(lons, lats)]

    res = engine.analyze_route(route_coords, model_name="rf")
    assert "segments" in res
    assert len(res["segments"]) >= 1
    assert 0.0 <= res["overall_risk"] <= 1.0
    assert res["total_crimes_nearby"] >= 0
    assert "incident_breakdown" in res
    assert res["model_used"] == "random_forest"

    # Verify segments integrity
    for seg in res["segments"]:
        assert seg["start_index"] <= seg["end_index"]
        assert 0.0 <= seg["risk_score"] <= 1.0
        assert seg["risk_level"] in ("low", "medium", "high")

def test_route_edge_cases():
    engine = RiskInferenceEngine.get_instance()

    # Empty route
    res_empty = engine.analyze_route([])
    assert res_empty["segments"] == []
    assert res_empty["overall_risk"] == 0.0

    # Single coordinate route
    res_single = engine.analyze_route([[77.2167, 28.6315]])
    assert len(res_single["segments"]) == 1
    assert res_single["segments"][0]["start_index"] == 0
    assert res_single["segments"][0]["end_index"] == 0

    # Invalid coordinates (non-numeric, NaN)
    pt_invalid = engine.predict_coordinate_risk(None, 77.0)
    assert pt_invalid["risk_level"] == "low"
    assert "fallback" in pt_invalid["model_used"]

def test_heatmap_points():
    engine = RiskInferenceEngine.get_instance()
    pts = engine.get_crime_points_for_heatmap()
    assert len(pts) == 166
    for p in pts:
        assert 28.0 <= p["latitude"] <= 29.0
        assert 76.5 <= p["longitude"] <= 77.6
        assert 1.0 <= p["severity"] <= 10.0
