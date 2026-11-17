import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd

from ..config import ARTIFACTS_DIR, DEFAULT_MODEL, RISK_THRESHOLDS
from .preprocessor import (
    SpatialFeatureExtractor,
    haversine_vectorized,
    is_valid_coordinate,
    is_within_delhi_region,
)

logger = logging.getLogger("safarixmaps.inference")

class RiskInferenceEngine:
    """
    Singleton inference engine for SafarixMaps.
    Loads trained Random Forest and XGBoost models, preprocessor, and station records.
    Provides sub-5ms route segment risk scoring, single-point risk inference, and fallbacks.
    """
    _instance: Optional["RiskInferenceEngine"] = None

    def __init__(self, artifacts_dir: Path = ARTIFACTS_DIR):
        self.artifacts_dir = artifacts_dir
        self.active_model_name = DEFAULT_MODEL  # 'rf' or 'xgb'
        self.rf_classifier = None
        self.rf_regressor = None
        self.xgb_classifier = None
        self.xgb_regressor = None
        self.extractor: Optional[SpatialFeatureExtractor] = None
        self.stations: List[Dict[str, Any]] = []
        self.station_lats: np.ndarray = np.array([])
        self.station_lons: np.ndarray = np.array([])
        self.metadata: Dict[str, Any] = {}
        self.metrics: Dict[str, Any] = {}
        self.is_loaded = False
        self._load_artifacts()

    @classmethod
    def get_instance(cls) -> "RiskInferenceEngine":
        if cls._instance is None:
            cls._instance = RiskInferenceEngine()
        return cls._instance

    def _load_artifacts(self):
        try:
            logger.info(f"Loading ML artifacts from {self.artifacts_dir}...")
            rf_cls_path = self.artifacts_dir / "rf_classifier.joblib"
            rf_reg_path = self.artifacts_dir / "rf_regressor.joblib"
            xgb_cls_path = self.artifacts_dir / "xgb_classifier.joblib"
            xgb_reg_path = self.artifacts_dir / "xgb_regressor.joblib"
            ext_path = self.artifacts_dir / "extractor.joblib"
            meta_path = self.artifacts_dir / "metadata.json"
            metrics_path = self.artifacts_dir / "metrics.json"
            stations_path = self.artifacts_dir / "stations_summary.json"

            if (
                rf_cls_path.exists()
                and rf_reg_path.exists()
                and xgb_cls_path.exists()
                and xgb_reg_path.exists()
                and ext_path.exists()
            ):
                self.rf_classifier = joblib.load(rf_cls_path)
                self.rf_regressor = joblib.load(rf_reg_path)
                self.xgb_classifier = joblib.load(xgb_cls_path)
                self.xgb_regressor = joblib.load(xgb_reg_path)
                self.extractor = joblib.load(ext_path)

            if meta_path.exists():
                with open(meta_path, "r", encoding="utf-8") as f:
                    self.metadata = json.load(f)

            if metrics_path.exists():
                with open(metrics_path, "r", encoding="utf-8") as f:
                    self.metrics = json.load(f)

            if stations_path.exists():
                with open(stations_path, "r", encoding="utf-8") as f:
                    self.stations = json.load(f)
                    self.station_lats = np.array([s["lat"] for s in self.stations], dtype=float)
                    self.station_lons = np.array([s["long"] for s in self.stations], dtype=float)

            self.is_loaded = (
                self.rf_classifier is not None
                and self.xgb_classifier is not None
                and self.extractor is not None
            )
            logger.info(f"ML artifacts loaded successfully. is_loaded={self.is_loaded}, active_model={self.active_model_name}")
        except Exception as e:
            logger.error(f"Error loading ML artifacts: {e}", exc_info=True)
            self.is_loaded = False

    def set_active_model(self, model_name: str) -> bool:
        """Switch active model between 'rf' and 'xgb'."""
        name = model_name.lower().strip()
        if name in ("rf", "random_forest", "randomforest"):
            self.active_model_name = "rf"
            return True
        elif name in ("xgb", "xgboost"):
            self.active_model_name = "xgb"
            return True
        return False

    def predict_coordinate_risk(
        self,
        lat: float,
        lon: float,
        model_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Predict crime risk score, risk level, probabilities, and nearest police station for a single point.
        """
        # Validate coordinates
        if not is_valid_coordinate(lat, lon):
            return {
                "risk_score": 0.1,
                "risk_level": "low",
                "probabilities": {"low": 1.0, "medium": 0.0, "high": 0.0},
                "model_used": "fallback_invalid_coords",
                "nearest_station": "Unknown",
                "distance_km": 0.0,
                "is_delhi_region": False
            }

        is_delhi = is_within_delhi_region(lat, lon)
        chosen_model = (model_name or self.active_model_name).lower()
        if chosen_model in ("random_forest", "randomforest"):
            chosen_model = "rf"
        elif chosen_model in ("xgboost",):
            chosen_model = "xgb"

        if not self.is_loaded:
            return self._fallback_single_point(lat, lon)

        try:
            df_in = pd.DataFrame([{"lat": lat, "long": lon}])
            feats = self.extractor.transform(df_in, is_training=False)

            if chosen_model == "xgb":
                cls_model = self.xgb_classifier
                reg_model = self.xgb_regressor
                used_label = "xgboost"
            else:
                cls_model = self.rf_classifier
                reg_model = self.rf_regressor
                used_label = "random_forest"

            # Predict continuous risk score via Regressor [0.0, 1.0]
            reg_pred = float(reg_model.predict(feats)[0])
            risk_score = float(np.clip(reg_pred, 0.0, 1.0))

            # Predict probabilities and discrete level via Classifier
            probs = cls_model.predict_proba(feats)[0]
            prob_dict = {
                "low": float(probs[0]),
                "medium": float(probs[1]),
                "high": float(probs[2])
            }

            # Map to discrete level based on score / thresholds
            if risk_score <= RISK_THRESHOLDS["low_max"]:
                risk_level = "low"
            elif risk_score <= RISK_THRESHOLDS["medium_max"]:
                risk_level = "medium"
            else:
                risk_level = "high"

            nearest_st, dist_km = self.extractor.find_nearest_station(lat, lon)

            return {
                "risk_score": round(risk_score, 4),
                "risk_level": risk_level,
                "probabilities": {k: round(v, 4) for k, v in prob_dict.items()},
                "model_used": used_label,
                "nearest_station": nearest_st,
                "distance_km": round(dist_km, 2),
                "is_delhi_region": is_delhi
            }
        except Exception as e:
            logger.error(f"Inference error on point ({lat}, {lon}): {e}", exc_info=True)
            return self._fallback_single_point(lat, lon)

    def analyze_route(
        self,
        coordinates: List[List[float]],
        model_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze an entire route given coordinates in [lng, lat] format (MapLibre / GeoJSON order).
        Returns segment-by-segment risk, overall risk score, total crimes nearby, and crime incident breakdown.
        """
        if not coordinates or len(coordinates) == 0:
            return {
                "segments": [],
                "overall_risk": 0.0,
                "total_crimes_nearby": 0,
                "incident_breakdown": {},
                "model_used": self.active_model_name
            }

        n_pts = len(coordinates)

        # Handle trivial single-point routes
        if n_pts == 1:
            lng, lat = coordinates[0][0], coordinates[0][1]
            pt_res = self.predict_coordinate_risk(lat, lng, model_name)
            return {
                "segments": [{
                    "start_index": 0,
                    "end_index": 0,
                    "risk_score": pt_res["risk_score"],
                    "risk_level": pt_res["risk_level"],
                    "crime_count": 0
                }],
                "overall_risk": pt_res["risk_score"],
                "total_crimes_nearby": 0,
                "incident_breakdown": {},
                "model_used": pt_res["model_used"]
            }

        # Divide route into logical segments (e.g. 10 to 25 coordinates per segment)
        # Aim for 4 to 12 segments across the route for high-resolution visual feedback
        seg_size = max(5, int(np.ceil(n_pts / 8.0)))
        segments_info = []

        start_idx = 0
        while start_idx < n_pts - 1:
            end_idx = min(start_idx + seg_size, n_pts - 1)
            # Pick midpoint coordinate of the segment for spatial inference
            mid_idx = (start_idx + end_idx) // 2
            mid_lng, mid_lat = coordinates[mid_idx][0], coordinates[mid_idx][1]

            pt_risk = self.predict_coordinate_risk(mid_lat, mid_lng, model_name)

            # Estimate nearby crimes for this segment midpoint
            crimes_nearby_seg = self._estimate_nearby_crimes(mid_lat, mid_lng, radius_km=1.5)

            segments_info.append({
                "start_index": start_idx,
                "end_index": end_idx,
                "risk_score": pt_risk["risk_score"],
                "risk_level": pt_risk["risk_level"],
                "crime_count": crimes_nearby_seg
            })

            start_idx = end_idx

        # Calculate overall weighted risk (average of segment risks)
        seg_scores = [s["risk_score"] for s in segments_info]
        overall_risk = float(np.mean(seg_scores)) if seg_scores else 0.0

        # Calculate route-wide crimes and breakdown within proximity buffer (1.5 km of all points)
        total_crimes, incident_breakdown = self._compute_route_incident_breakdown(coordinates)

        chosen = (model_name or self.active_model_name).lower()
        model_label = "xgboost" if "xgb" in chosen else "random_forest"

        return {
            "segments": segments_info,
            "overall_risk": round(overall_risk, 3),
            "total_crimes_nearby": int(total_crimes),
            "incident_breakdown": incident_breakdown,
            "model_used": model_label
        }

    def get_crime_points_for_heatmap(self) -> List[Dict[str, float]]:
        """
        Returns list of points { latitude, longitude, severity } for MapLibre GL heatmap.
        Derived from verified station records with scaled severity (1.0 to 10.0).
        """
        if not self.stations:
            return []

        heatmap_pts = []
        densities = [s["crime_per_area"] for s in self.stations]
        min_d = min(densities) if densities else 0
        max_d = max(densities) if densities else 1

        for s in self.stations:
            # Scale severity smoothly between 2.0 and 10.0
            norm = (s["crime_per_area"] - min_d) / (max_d - min_d + 1e-6)
            severity = round(2.0 + norm * 8.0, 1)
            heatmap_pts.append({
                "latitude": s["lat"],
                "longitude": s["long"],
                "severity": severity
            })

        return heatmap_pts

    def _estimate_nearby_crimes(self, lat: float, lon: float, radius_km: float = 1.5) -> int:
        """Estimate crime count from historical stations within radius."""
        if len(self.station_lats) == 0:
            return 0
        dists = haversine_vectorized(self.station_lats, self.station_lons, lat, lon)
        nearby_mask = dists <= radius_km
        if not np.any(nearby_mask):
            # Proportional to nearest station
            nearest_idx = np.argmin(dists)
            nearest_d = dists[nearest_idx]
            decay = max(0.1, 1.0 / (1.0 + nearest_d))
            return int(self.stations[nearest_idx]["totalcrime"] * decay * 0.1)

        nearby_indices = np.where(nearby_mask)[0]
        count = sum(self.stations[idx]["totalcrime"] for idx in nearby_indices)
        return int(count)

    def _compute_route_incident_breakdown(
        self,
        coordinates: List[List[float]],
        sample_step: int = 10,
        radius_km: float = 2.0
    ) -> Tuple[int, Dict[str, int]]:
        """Compute aggregated crime categories near the route trajectory."""
        if len(self.station_lats) == 0:
            return (0, {})

        # Subsample route points for fast spatial query
        sampled_pts = coordinates[::max(1, sample_step)]
        sampled_lats = np.array([p[1] for p in sampled_pts], dtype=float)
        sampled_lons = np.array([p[0] for p in sampled_pts], dtype=float)

        matched_station_indices = set()
        for lat, lon in zip(sampled_lats, sampled_lons):
            dists = haversine_vectorized(self.station_lats, self.station_lons, lat, lon)
            for idx in np.where(dists <= radius_km)[0]:
                matched_station_indices.add(int(idx))

        if not matched_station_indices:
            # If no station within 2km, match the 2 nearest stations
            mid_idx = len(coordinates) // 2
            dists = haversine_vectorized(
                self.station_lats, self.station_lons,
                coordinates[mid_idx][1], coordinates[mid_idx][0]
            )
            matched_station_indices.update(np.argsort(dists)[:2])

        breakdown = {
            "Theft": 0,
            "Robbery": 0,
            "Rape": 0,
            "Assault Murders": 0,
            "Sexual Harassment": 0,
            "Murder": 0,
            "Gangrape": 0,
        }
        total_crimes = 0

        for idx in matched_station_indices:
            st = self.stations[idx]
            breakdown["Theft"] += st.get("theft", 0)
            breakdown["Robbery"] += st.get("robbery", 0)
            breakdown["Rape"] += st.get("rape", 0)
            breakdown["Assault Murders"] += st.get("assualt_murders", 0)
            breakdown["Sexual Harassment"] += st.get("sexual_harassement", 0)
            breakdown["Murder"] += st.get("murder", 0)
            breakdown["Gangrape"] += st.get("gangrape", 0)
            total_crimes += st.get("totalcrime", 0)

        # Filter out 0 counts for clean presentation
        clean_breakdown = {k: v for k, v in breakdown.items() if v > 0}
        return (total_crimes, clean_breakdown)

    def _fallback_single_point(self, lat: float, lon: float) -> Dict[str, Any]:
        """Spatial heuristic fallback when ML models are uninitialized."""
        if len(self.station_lats) > 0:
            dists = haversine_vectorized(self.station_lats, self.station_lons, lat, lon)
            nearest_idx = int(np.argmin(dists))
            st = self.stations[nearest_idx]
            # Normalize crime/area
            c_area = st.get("crime_per_area", 100.0)
            norm_score = min(1.0, max(0.0, c_area / 400.0))
            level = "low" if norm_score < 0.33 else ("medium" if norm_score < 0.66 else "high")
            return {
                "risk_score": round(norm_score, 4),
                "risk_level": level,
                "probabilities": {"low": 0.33, "medium": 0.33, "high": 0.34},
                "model_used": "spatial_fallback",
                "nearest_station": st.get("name", "Unknown"),
                "distance_km": round(float(dists[nearest_idx]), 2),
                "is_delhi_region": is_within_delhi_region(lat, lon)
            }
        return {
            "risk_score": 0.25,
            "risk_level": "low",
            "probabilities": {"low": 1.0, "medium": 0.0, "high": 0.0},
            "model_used": "hardcoded_safe_fallback",
            "nearest_station": "Unknown",
            "distance_km": 0.0,
            "is_delhi_region": False
        }
