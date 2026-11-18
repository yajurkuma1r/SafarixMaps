import sys
import types
import joblib
import pandas as pd
import pytest

from backend.app.config import ARTIFACTS_DIR
from backend.app.ml.preprocessor import SpatialFeatureExtractor, register_compatibility_aliases
from backend.app.ml.inference import RiskInferenceEngine
from backend.app.main import root


def test_reproduce_original_failure_without_alias():
    """
    Reproduces the exact Vercel failure:
    When running where the backend package is root (so 'backend' is not in sys.modules
    and not on sys.path), attempting to joblib.load() extractor.joblib fails with
    ModuleNotFoundError: No module named 'backend'.
    """
    import os

    orig_path = list(sys.path)
    stashed_modules = {}
    for mod_name in list(sys.modules.keys()):
        if mod_name == "backend" or mod_name.startswith("backend."):
            stashed_modules[mod_name] = sys.modules.pop(mod_name)

    # Filter sys.path so 'backend' cannot be found on disk as a package
    sys.path = [p for p in sys.path if not os.path.exists(os.path.join(p, "backend"))]

    ext_path = ARTIFACTS_DIR / "extractor.joblib"
    assert ext_path.exists(), f"Extractor artifact not found at {ext_path}"

    try:
        # Without 'backend' in sys.modules or on sys.path, unpickling must fail with ModuleNotFoundError('backend')
        with pytest.raises(ModuleNotFoundError) as exc_info:
            joblib.load(ext_path)

        assert "backend" in str(exc_info.value), f"Expected 'backend' in error, got: {exc_info.value}"
    finally:
        # Restore sys.path and sys.modules
        sys.path = orig_path
        sys.modules.update(stashed_modules)
        register_compatibility_aliases()


def test_register_compatibility_aliases_hierarchy():
    """
    Verifies that register_compatibility_aliases() registers the complete parent
    package hierarchy in sys.modules, not merely leaf modules.
    """
    register_compatibility_aliases()

    # 1. Full hierarchy in sys.modules
    assert "backend" in sys.modules, "sys.modules['backend'] must exist"
    assert "backend.app" in sys.modules, "sys.modules['backend.app'] must exist"
    assert "backend.app.ml" in sys.modules, "sys.modules['backend.app.ml'] must exist"
    assert "backend.app.ml.preprocessor" in sys.modules, "sys.modules['backend.app.ml.preprocessor'] must exist"

    backend_mod = sys.modules["backend"]
    assert hasattr(backend_mod, "__path__"), "backend module must have __path__ defined"

    # 2. Parent-to-child attribute traversal
    assert hasattr(backend_mod, "app"), "backend must have .app attribute"
    assert hasattr(backend_mod.app, "ml"), "backend.app must have .ml attribute"
    assert hasattr(backend_mod.app.ml, "preprocessor"), "backend.app.ml must have .preprocessor attribute"

    # 3. Class identity resolution
    aliased_cls = getattr(backend_mod.app.ml.preprocessor, "SpatialFeatureExtractor")
    assert aliased_cls is SpatialFeatureExtractor, "Aliased class must resolve to the identical class object"


def test_joblib_loads_extractor_with_alias():
    """
    Verifies that extractor.joblib loads successfully when the compatibility hierarchy is registered,
    preserving its 166 learned station records and transformation capability.
    """
    register_compatibility_aliases()

    ext_path = ARTIFACTS_DIR / "extractor.joblib"
    extractor = joblib.load(ext_path)

    assert isinstance(extractor, SpatialFeatureExtractor)
    assert len(extractor.station_lats) == 166
    assert len(extractor.station_lons) == 166
    assert len(extractor.station_names) == 166

    # Verify transform produces 19 features without NaN
    df_query = pd.DataFrame([{"lat": 28.6315, "long": 77.2167}])
    feats = extractor.transform(df_query, is_training=False)
    assert feats.shape == (1, 19)
    assert not feats.isnull().any().any()


def test_inference_engine_loads_all_artifacts_in_vercel_mode():
    """
    Verifies that RiskInferenceEngine successfully loads all ML models and artifacts
    (RF, XGB, extractor, station summary, metadata, metrics).
    """
    register_compatibility_aliases()

    engine = RiskInferenceEngine.get_instance()
    assert engine.is_loaded is True
    assert engine.rf_classifier is not None
    assert engine.rf_regressor is not None
    assert engine.xgb_classifier is not None
    assert engine.xgb_regressor is not None
    assert engine.extractor is not None
    assert len(engine.stations) == 166

    # Test coordinate risk prediction
    res = engine.predict_coordinate_risk(28.6315, 77.2167)
    assert 0.0 <= res["risk_score"] <= 1.0
    assert res["risk_level"] in ("low", "medium", "high")
    assert res["is_delhi_region"] is True
    assert "PARLIAMENT STREET" in res["nearest_station"] or res["distance_km"] < 2.0


def test_root_endpoint_reports_model_loaded():
    """
    Verifies that the FastAPI root endpoint reports 'is_model_loaded': True.
    """
    register_compatibility_aliases()

    # Invoke root endpoint coroutine directly
    coro = root()
    try:
        coro.send(None)
    except StopIteration as e:
        data = e.value

    assert data["status"] == "online"
    assert data["is_model_loaded"] is True
    assert data["active_model"] in ("rf", "xgb")
