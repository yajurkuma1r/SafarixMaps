import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["is_model_loaded"] is True

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_get_crimes():
    response = client.get("/api/risk/crimes")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 100
    first = data[0]
    assert "latitude" in first
    assert "longitude" in first
    assert "severity" in first

def test_predict_point():
    payload = {"latitude": 28.6315, "longitude": 77.2167}
    response = client.post("/api/risk/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert 0.0 <= data["risk_score"] <= 1.0
    assert data["risk_level"] in ("low", "medium", "high")
    assert "probabilities" in data
    assert data["is_delhi_region"] is True

def test_analyze_route():
    # Route in Delhi from Connaught Place to India Gate
    coords = [
        [77.2167, 28.6315],
        [77.2200, 28.6250],
        [77.2250, 28.6200],
        [77.2295, 28.6129]
    ]
    response = client.post("/api/risk/analyze", json={"coordinates": coords})
    assert response.status_code == 200
    data = response.json()
    assert "segments" in data
    assert len(data["segments"]) > 0
    assert "overall_risk" in data
    assert 0.0 <= data["overall_risk"] <= 1.0
    assert "total_crimes_nearby" in data
    assert "incident_breakdown" in data

def test_ml_endpoints():
    r_metrics = client.get("/api/ml/metrics")
    assert r_metrics.status_code == 200
    assert "classification" in r_metrics.json()

    r_comp = client.get("/api/ml/comparison")
    assert r_comp.status_code == 200
    assert "recommended_production_model" in r_comp.json()

    r_switch = client.post("/api/ml/select-model", json={"model": "xgb"})
    assert r_switch.status_code == 200
    assert r_switch.json()["active_model"] == "xgb"

    # Switch back to rf
    r_switch2 = client.post("/api/ml/select-model", json={"model": "rf"})
    assert r_switch2.status_code == 200
    assert r_switch2.json()["active_model"] == "rf"

if __name__ == "__main__":
    test_root()
    test_health()
    test_get_crimes()
    test_predict_point()
    test_analyze_route()
    test_ml_endpoints()
    print("ALL SANITY TESTS PASSED!")
