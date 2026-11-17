from backend.app.ml.inference import RiskInferenceEngine

engine = RiskInferenceEngine.get_instance()
print("Engine loaded:", engine.is_loaded)
print("Active model:", engine.active_model_name)
pt = engine.predict_coordinate_risk(28.6139, 77.2090)
print("Test point (RF):", pt)
engine.set_active_model("xgb")
pt_xgb = engine.predict_coordinate_risk(28.6139, 77.2090)
print("Test point (XGB):", pt_xgb)
print("ALL SUCCESSFUL!")
