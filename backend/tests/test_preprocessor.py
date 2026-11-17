import numpy as np
import pandas as pd
import pytest
from backend.app.ml.preprocessor import (
    haversine_vectorized,
    is_valid_coordinate,
    is_within_delhi_region,
    SpatialFeatureExtractor,
    load_crime_dataset
)
from backend.app.config import DATASET_PATH

def test_is_valid_coordinate():
    assert is_valid_coordinate(28.6139, 77.2090) is True
    assert is_valid_coordinate(-90.0, 180.0) is True
    assert is_valid_coordinate(91.0, 77.0) is False
    assert is_valid_coordinate(28.0, 181.0) is False
    assert is_valid_coordinate(None, 77.0) is False
    assert is_valid_coordinate(float('nan'), 77.0) is False
    assert is_valid_coordinate(float('inf'), 77.0) is False

def test_is_within_delhi_region():
    # Connaught Place, Central Delhi
    assert is_within_delhi_region(28.6315, 77.2167) is True
    # Dwarka, West Delhi
    assert is_within_delhi_region(28.5921, 77.0460) is True
    # Mumbai coordinates
    assert is_within_delhi_region(19.0760, 72.8777) is False
    # Far away point
    assert is_within_delhi_region(0.0, 0.0) is False

def test_haversine_vectorized():
    # Distance between CP (28.6315, 77.2167) and India Gate (28.6129, 77.2295) is approx 2.4 km
    d = haversine_vectorized(
        np.array([28.6315]), np.array([77.2167]),
        28.6129, 77.2295
    )
    assert len(d) == 1
    assert 2.0 <= d[0] <= 3.0

    # Zero distance
    d0 = haversine_vectorized(
        np.array([28.6315]), np.array([77.2167]),
        28.6315, 77.2167
    )
    assert pytest.approx(d0[0], abs=1e-5) == 0.0

def test_spatial_feature_extractor():
    sample_stations = pd.DataFrame([
        {"lat": 28.6315, "long": 77.2167, "nm_pol": "CP"},
        {"lat": 28.5200, "long": 77.2100, "nm_pol": "Saket"},
        {"lat": 28.6700, "long": 77.2200, "nm_pol": "Civil Lines"},
    ])
    extractor = SpatialFeatureExtractor(sample_stations)

    # Transform inference point
    query = pd.DataFrame([{"lat": 28.6300, "long": 77.2150}])
    feats = extractor.transform(query, is_training=False)

    assert len(feats) == 1
    assert "lat" in feats.columns
    assert "long" in feats.columns
    assert "dist_cp_km" in feats.columns
    assert "dist_nearest_st_km" in feats.columns
    assert "st_density_3km" in feats.columns
    assert not feats.isnull().any().any()

    # Nearest station finding
    name, dist = extractor.find_nearest_station(28.6310, 77.2165)
    assert name == "CP"
    assert dist < 0.2

def test_dataset_loading():
    csr, esr, meta = load_crime_dataset(str(DATASET_PATH))
    assert len(csr) == 166
    assert "crime/area" in csr.columns
    assert "totalcrime" in csr.columns
    assert "lat" in csr.columns
    assert "long" in csr.columns
    assert csr['lat'].isnull().sum() == 0
    assert csr['long'].isnull().sum() == 0
    assert len(esr) == 71
    assert "sheets" in meta
