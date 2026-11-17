import numpy as np
import pandas as pd
from typing import Tuple, List, Dict, Any, Optional
from ..config import REGIONAL_HUBS, CP_LAT, CP_LON, DELHI_BOUNDS, DATASET_PATH

def haversine_vectorized(lat1: np.ndarray, lon1: np.ndarray, lat2: float, lon2: float) -> np.ndarray:
    """Calculate the great circle distance between arrays of points and a reference point in km."""
    R = 6371.0
    dlat = np.radians(lat2 - lat1)
    dlon = np.radians(lon2 - lon1)
    a = np.sin(dlat / 2.0)**2 + np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(dlon / 2.0)**2
    c = 2.0 * np.arctan2(np.sqrt(a), np.sqrt(1.0 - a))
    return R * c

def is_valid_coordinate(lat: float, lon: float) -> bool:
    """Check if lat and lon are valid finite numbers."""
    if lat is None or lon is None:
        return False
    try:
        lat = float(lat)
        lon = float(lon)
        return bool(
            np.isfinite(lat) and np.isfinite(lon) and
            -90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0
        )
    except (ValueError, TypeError):
        return False

def is_within_delhi_region(lat: float, lon: float) -> bool:
    """Check if point is approximately within Delhi NCR bounds."""
    if not is_valid_coordinate(lat, lon):
        return False
    return (
        DELHI_BOUNDS["min_lat"] <= lat <= DELHI_BOUNDS["max_lat"] and
        DELHI_BOUNDS["min_lon"] <= lon <= DELHI_BOUNDS["max_lon"]
    )

class SpatialFeatureExtractor:
    """
    Extracts spatial, territorial, and proximity features from coordinates.
    Trained against the 166 verified Delhi police station geographic coordinates.
    """
    def __init__(self, station_coords: Optional[pd.DataFrame] = None):
        if station_coords is not None:
            self.station_lats = station_coords['lat'].to_numpy(dtype=float)
            self.station_lons = station_coords['long'].to_numpy(dtype=float)
            if 'nm_pol' in station_coords.columns:
                self.station_names = station_coords['nm_pol'].tolist()
            else:
                self.station_names = [f"Station_{i}" for i in range(len(self.station_lats))]
        else:
            self.station_lats = np.array([])
            self.station_lons = np.array([])
            self.station_names = []

    def set_station_coords(self, lats: np.ndarray, lons: np.ndarray, names: Optional[List[str]] = None):
        self.station_lats = np.asarray(lats, dtype=float)
        self.station_lons = np.asarray(lons, dtype=float)
        if names is not None:
            self.station_names = list(names)
        else:
            self.station_names = [f"Station_{i}" for i in range(len(self.station_lats))]

    def transform(self, df_coords: pd.DataFrame, is_training: bool = False) -> pd.DataFrame:
        """
        Transform a DataFrame containing 'lat' and 'long' into model feature matrix.
        If is_training is True, self-distance (dist == 0) is excluded for nearest station.
        """
        lat_arr = df_coords['lat'].to_numpy(dtype=float)
        lon_arr = df_coords['long'].to_numpy(dtype=float)
        n = len(df_coords)

        feats = pd.DataFrame(index=df_coords.index)
        feats['lat'] = lat_arr
        feats['long'] = lon_arr

        # Distances to predefined regional anchors
        for name, (hlat, hlon) in REGIONAL_HUBS.items():
            feats[f'dist_{name}_km'] = haversine_vectorized(lat_arr, lon_arr, hlat, hlon)

        # Coordinate offsets from center
        feats['delta_lat'] = lat_arr - CP_LAT
        feats['delta_lon'] = lon_arr - CP_LON
        feats['radial_dist'] = np.sqrt(feats['delta_lat']**2 + feats['delta_lon']**2)
        feats['bearing_deg'] = np.degrees(np.arctan2(feats['delta_lon'], feats['delta_lat'])) % 360.0

        # Station proximity and density features
        if len(self.station_lats) > 0:
            min_dist_1 = np.zeros(n, dtype=float)
            min_dist_2 = np.zeros(n, dtype=float)
            dens_3km = np.zeros(n, dtype=int)
            dens_5km = np.zeros(n, dtype=int)
            dens_8km = np.zeros(n, dtype=int)

            for i in range(n):
                cur_lat = lat_arr[i]
                cur_lon = lon_arr[i]
                dists = haversine_vectorized(self.station_lats, self.station_lons, cur_lat, cur_lon)

                if is_training:
                    # In training against station data itself, ignore self (dist < 0.05 km)
                    valid_dists = dists[dists >= 0.05]
                else:
                    valid_dists = dists

                if len(valid_dists) > 0:
                    sorted_d = np.sort(valid_dists)
                    min_dist_1[i] = sorted_d[0]
                    min_dist_2[i] = sorted_d[1] if len(sorted_d) > 1 else sorted_d[0]
                else:
                    min_dist_1[i] = 0.0
                    min_dist_2[i] = 0.0

                dens_3km[i] = int(np.sum((dists <= 3.0) & (dists >= (0.05 if is_training else 0.0))))
                dens_5km[i] = int(np.sum((dists <= 5.0) & (dists >= (0.05 if is_training else 0.0))))
                dens_8km[i] = int(np.sum((dists <= 8.0) & (dists >= (0.05 if is_training else 0.0))))

            feats['dist_nearest_st_km'] = min_dist_1
            feats['dist_second_st_km'] = min_dist_2
            feats['st_density_3km'] = dens_3km
            feats['st_density_5km'] = dens_5km
            feats['st_density_8km'] = dens_8km
        else:
            feats['dist_nearest_st_km'] = 0.0
            feats['dist_second_st_km'] = 0.0
            feats['st_density_3km'] = 0
            feats['st_density_5km'] = 0
            feats['st_density_8km'] = 0

        return feats

    def find_nearest_station(self, lat: float, lon: float) -> Tuple[str, float]:
        """Find the nearest police station name and distance in km."""
        if len(self.station_lats) == 0:
            return ("Unknown Station", 0.0)
        dists = haversine_vectorized(self.station_lats, self.station_lons, lat, lon)
        min_idx = int(np.argmin(dists))
        name = self.station_names[min_idx] if min_idx < len(self.station_names) else f"Station_{min_idx}"
        return (name, float(dists[min_idx]))

def load_crime_dataset(file_path: Optional[str] = None) -> Tuple[pd.DataFrame, pd.DataFrame, Dict[str, Any]]:
    """
    Load Crime_Source_Raw and event/quality sheets from the Excel workbook.
    Returns:
    - csr: DataFrame of 166 verified Delhi police station records.
    - esr: DataFrame of event-level records (with quality flags).
    - metadata: Summary of sheets, quality observations, and preprocessing details.
    """
    path = file_path or DATASET_PATH
    xl = pd.ExcelFile(path)

    csr = xl.parse("Crime_Source_Raw")
    esr = xl.parse("Event_Source_Raw")
    dq = xl.parse("Data_Quality")
    msw = xl.parse("Mock_Score_Weights")

    metadata = {
        "sheets": xl.sheet_names,
        "station_records_count": len(csr),
        "event_records_count": len(esr),
        "data_quality_notes": dq.to_dict(orient="records"),
        "mock_score_weights": msw.to_dict(orient="records")
    }

    # Ensure required columns exist
    req_cols = ['lat', 'long', 'crime/area', 'totalcrime', 'totarea']
    for c in req_cols:
        if c not in csr.columns:
            raise ValueError(f"Missing required column '{c}' in Crime_Source_Raw")

    return csr, esr, metadata
