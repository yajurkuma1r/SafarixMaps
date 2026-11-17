import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_api_root():
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert data["service"] == "SafarixMaps ML Crime-Risk Engine"
    assert data["status"] == "online"
    assert "endpoints" in data

def test_api_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"

def test_api_crimes_heatmap():
    res = client.get("/api/risk/crimes")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) == 166
    for item in data[:5]:
        assert "latitude" in item
        assert "longitude" in item
        assert "severity" in item
        assert 1.0 <= item["severity"] <= 10.0

def test_api_predict_point():
    payload = {"latitude": 28.5363, "longitude": 77.2492} # Chittaranjan Park
    res = client.post("/api/risk/predict", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert 0.0 <= data["risk_score"] <= 1.0
    assert data["risk_level"] in ("low", "medium", "high")
    assert "probabilities" in data
    assert "CHITRANJAN" in data["nearest_station"] or data["distance_km"] < 1.0

def test_api_analyze_route():
    # Test valid route
    payload = {
        "coordinates": [
            [77.2090, 28.6139],
            [77.2150, 28.6200],
            [77.2200, 28.6300],
            [77.2250, 28.6400],
            [77.2300, 28.6500]
        ]
    }
    res = client.post("/api/risk/analyze", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "segments" in data
    assert len(data["segments"]) > 0
    assert "overall_risk" in data
    assert "total_crimes_nearby" in data
    assert "incident_breakdown" in data

    # Verify each segment matches frontend expected contract
    for seg in data["segments"]:
        assert "start_index" in seg
        assert "end_index" in seg
        assert "risk_score" in seg
        assert "risk_level" in seg
        assert seg["risk_level"] in ("low", "medium", "high")
        assert "crime_count" in seg

def test_api_analyze_empty_route_error():
    res = client.post("/api/risk/analyze", json={"coordinates": []})
    assert res.status_code == 400

def test_api_ml_metrics():
    res = client.get("/api/ml/metrics")
    assert res.status_code == 200
    data = res.json()
    assert "classification" in data
    assert "regression" in data
    assert "random_forest" in data["classification"]
    assert "xgboost" in data["classification"]

def test_api_ml_comparison():
    res = client.get("/api/ml/comparison")
    assert res.status_code == 200
    data = res.json()
    assert "recommended_production_model" in data
    assert "rationale" in data
    assert "classification_summary" in data

def test_api_ml_feature_importance():
    res = client.get("/api/ml/feature-importance")
    assert res.status_code == 200
    data = res.json()
    assert "rf_classifier" in data
    assert "xgb_classifier" in data

def test_api_ml_info():
    res = client.get("/api/ml/info")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ready"
    assert "metadata" in data

def test_api_select_model():
    # Switch to XGBoost
    res1 = client.post("/api/ml/select-model", json={"model": "xgb"})
    assert res1.status_code == 200
    assert res1.json()["active_model"] == "xgb"

    # Verify analyze route reflects active model
    res_route = client.post("/api/risk/analyze", json={"coordinates": [[77.2090, 28.6139], [77.2150, 28.6200]]})
    assert res_route.status_code == 200
    assert res_route.json()["model_used"] == "xgboost"

    # Switch back to Random Forest
    res2 = client.post("/api/ml/select-model", json={"model": "rf"})
    assert res2.status_code == 200
    assert res2.json()["active_model"] == "rf"

    # Invalid model
    res3 = client.post("/api/ml/select-model", json={"model": "unknown_model"})
    assert res3.status_code == 400
