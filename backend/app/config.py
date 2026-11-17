import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent
DATASET_PATH = PROJECT_ROOT / "SafarixMaps_Combined_Crime_Dataset.xlsx"
ARTIFACTS_DIR = BASE_DIR / "app" / "ml" / "artifacts"
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

# Geographic Bounds for Delhi NCR
DELHI_BOUNDS = {
    "min_lat": 28.30,
    "max_lat": 28.95,
    "min_lon": 76.80,
    "max_lon": 77.50,
}

# Central Reference Point (Connaught Place, New Delhi)
CP_LAT = 28.6315
CP_LON = 77.2167

# Major Regional Proximity Anchors
REGIONAL_HUBS = {
    "cp": (28.6315, 77.2167),          # Central Delhi
    "north": (28.6700, 77.2200),       # North Delhi / Civil Lines
    "south": (28.5200, 77.2100),       # South Delhi / Saket
    "west": (28.6100, 77.0700),        # West Delhi / Janakpuri
    "east": (28.6000, 77.3000),        # East Delhi / Mayur Vihar
    "airport": (28.5562, 77.0990),     # IGI Airport
    "old_delhi": (28.6562, 77.2300),   # Old Delhi / Chandni Chowk
    "rohini": (28.7100, 77.1200),      # Rohini / Northwest
}

# Crime Harm Weights (based on Indian Penal Code / criminological severity)
CRIME_HARM_WEIGHTS = {
    "murder": 10.0,
    "gangrape": 10.0,
    "rape": 9.0,
    "assualt murders": 9.0,
    "robbery": 7.0,
    "sexual harassement": 7.0,
    "theft": 4.0,
}

# Risk thresholds (calibrated to tertiles of crime density)
# 0.00 to 0.33 -> low
# 0.33 to 0.66 -> medium
# 0.66 to 1.00 -> high
RISK_THRESHOLDS = {
    "low_max": 0.3333,
    "medium_max": 0.6667,
}

# Active default model ('rf' or 'xgb')
DEFAULT_MODEL = "rf"
