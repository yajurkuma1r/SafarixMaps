# SafarixMaps — ML-Powered Crime-Risk Aware Navigation System

SafarixMaps is an intelligent, safety-first urban navigation platform that dynamically integrates Machine Learning (**Random Forest** and **XGBoost**) with real-time routing to guide pedestrians and drivers away from high-risk crime zones in Delhi NCR.

---

## 1. System Architecture

SafarixMaps combines a modern Next.js client with a high-performance FastAPI machine learning backend:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   SAFARIXMAPS ARCHITECTURE OVERVIEW                    │
└────────────────────────────────────────────────────────────────────────┘

  [ Next.js 16 Client (Port 3000) ]
        │
        ├── 🧭 Navigation HUD (useForwardScan, useSaferRoute, useLiveRisk)
        ├── 🔍 Search & Geocoding (TomTom Search API biased to Delhi NCR)
        ├── 🗺️ MapLibre GL Map View (TomTom Dark Tiles, 3D Extrusion)
        └── 📊 Route Preview & Safety Comparison (Safest vs Fastest)
        │
        ▼ HTTP REST (Async, Sub-20ms)
  [ FastAPI Machine Learning Engine (Port 8000) ]
        │
        ├── 📍 /api/risk/analyze       ──> Route Trajectory Risk & Incident Breakdown
        ├── 🗺️ /api/risk/crimes        ──> Spatial Heatmap Coordinates & Severity
        ├── 🎯 /api/risk/predict       ──> Single-Coordinate Risk Scoring
        ├── 📈 /api/ml/metrics         ──> Classification & Regression Metrics
        └── ⚙️ /api/ml/select-model    ──> Runtime Model Toggling ('rf' vs 'xgb')
        │
        ▼ In-Memory Cached Singleton
  [ ML Inference Engine (RiskInferenceEngine) ]
        │
        ├── 🌲 Random Forest Classifier & Regressor (Production Recommended)
        ├── ⚡ XGBoost Classifier & Regressor (Alternative Model)
        ├── 📐 Spatial Feature Extractor (Proximity, Density, Anchors)
        └── 🛡️ Safe Spatial Heuristic Fallback
```

---

## 2. Dataset Analysis & Data Quality

The spatial modeling is grounded in `SafarixMaps_Combined_Crime_Dataset.xlsx`, which contains five sheets:

| Sheet Name | Rows | Record Granularity | Observations & Data Characteristics |
|---|---|---|---|
| **Crime_Source_Raw** | 166 | Police Station Aggregates | Verified Delhi NCR police stations with exact coordinates (`lat`, `long`), jurisdictional area (`area`, `totarea`), total crimes, and category counts (`murder`, `rape`, `gangrape`, `robbery`, `theft`, `assualt murders`, `sexual harassement`). No missing coordinates. **Primary training source.** |
| **Event_Source_Raw** | 71 | Event-Level Records | Contains only 71 records spanning 2 years with geographic inconsistencies (e.g. 33 Mumbai locations like Colaba/Dadar assigned Delhi coordinates). |
| **Combined_Records** | 1233 | Unified Schema | Standardized compilation preserving original record granularity to avoid false equivalence. |
| **Data_Quality** | 4 | Audit Log | Explicitly notes: *Do not treat expanded category rows as individual incidents; validate coordinates; synthetic scores are illustrative proxies only.* |
| **Mock_Score_Weights**| 7 | Criminological Weights | Harm weighting guidelines (Murder: 10, Rape: 9, Gangrape: 10, Robbery: 7, Theft: 4, etc.). |

### Critical Preprocessing Decisions
1. **Preserving Record Granularity**: Aggregate police station figures are not conflated with individual event records.
2. **Exclusion of Synthetic Scores**: Pre-existing mock scores were not used as training targets; instead, objective empirical crime density (`crime/area`) was derived.
3. **Temporal Modeling Restraint**: With only 71 event-level records available, time-dependent modeling would suffer from severe statistical noise and overfitting. Meaningful temporal modeling requires timestamped incident records and was deliberately not manufactured.

---

## 3. Feature Engineering

For any queried geographic point `(latitude, longitude)`, the `SpatialFeatureExtractor` generates 19 spatial features without target leakage:

1. **Raw Coordinates**: `lat`, `long`
2. **Radial Hub Distances**: Great-circle distances (km) to 8 regional nodes in Delhi NCR:
   - Central Delhi (Connaught Place: `28.6315, 77.2167`)
   - North Delhi (Civil Lines: `28.6700, 77.2200`)
   - South Delhi (Saket: `28.5200, 77.2100`)
   - West Delhi (Janakpuri: `28.6100, 77.0700`)
   - East Delhi (Mayur Vihar / Trans-Yamuna: `28.6000, 77.3000`)
   - IGI Airport (`28.5562, 77.0990`)
   - Old Delhi (Chandni Chowk: `28.6562, 77.2300`)
   - Northwest Delhi (Rohini: `28.7100, 77.1200`)
3. **Centroid Offsets & Bearing**: `delta_lat`, `delta_lon`, `radial_dist`, `bearing_deg`
4. **Police Station Spatial Proximity**:
   - `dist_nearest_st_km`: Distance to the closest police station
   - `dist_second_st_km`: Distance to the second closest station
5. **Urban Station Density**:
   - `st_density_3km`: Number of stations within 3 km
   - `st_density_5km`: Number of stations within 5 km
   - `st_density_8km`: Number of stations within 8 km

---

## 4. Machine Learning Formulation & Evaluation

### Objectives
- **Classification Task**: 3-class risk tier (`low`, `medium`, `high`) based on empirical crime density tertiles (`q33 = 86.03`, `q66 = 196.75` crimes/km²).
- **Regression Task**: Continuous crime-risk score in `[0.0, 1.0]` (min-max scaled log-transformed crime density).

### Evaluation Methodology
- **Train / Test Split**: 80% train (132 stations), 20% test (34 stations), stratified by class label, `random_state=42`.
- **Cross-Validation**: 5-fold Stratified K-Fold for classification; 5-fold K-Fold for regression.
- **Baseline**: `DummyClassifier(strategy="most_frequent")` and `DummyRegressor(strategy="mean")`.

### Results Comparison

#### Classification Performance (Test Set: N=34)

| Metric | Dummy Baseline | Random Forest Classifier | XGBoost Classifier | Winner |
|---|---|---|---|---|
| **Accuracy** | 32.4% | **50.0%** | 44.1% | **Random Forest (+17.6% over baseline)** |
| **Precision (Macro)** | 10.8% | **55.9%** | 51.7% | **Random Forest** |
| **Recall (Macro)** | 33.3% | **50.3%** | 44.2% | **Random Forest** |
| **Recall (High-Risk)** | 0.0% | **54.5%** | 36.4% | **Random Forest (+18.1% over XGB)** |
| **F1-Score (Macro)** | 0.163 | **0.517** | 0.464 | **Random Forest** |
| **F1-Score (Weighted)** | 0.158 | **0.513** | 0.461 | **Random Forest** |
| **5-Fold CV Accuracy** | 33.3% | **46.3% (±8.2%)** | 43.2% (±8.8%) | **Random Forest** |

#### Confusion Matrices (Rows: Actual [Low, Med, High], Cols: Predicted [Low, Med, High])

**Random Forest Classifier:**
```
            Pred Low   Pred Med   Pred High
Actual Low      6          4          1
Actual Med      1          5          6
Actual High     0          5          6
```
*(Notice: Random Forest produced ZERO high-risk false negatives misclassified as low-risk.)*

**XGBoost Classifier:**
```
            Pred Low   Pred Med   Pred High
Actual Low      6          5          0
Actual Med      1          5          6
Actual High     0          7          4
```

#### Regression Performance (Continuous Risk Score: [0.0, 1.0])

| Metric | Dummy Baseline | Random Forest Regressor | XGBoost Regressor |
|---|---|---|---|
| **MAE** | 0.1716 | **0.1133** | 0.1146 |
| **RMSE** | 0.2162 | **0.1401** | 0.1454 |
| **R² Score** | -0.0005 | **0.5797** | 0.5471 |

### Top Predictive Features
1. `dist_nearest_st_km` & `dist_second_st_km` (~21% total importance)
2. `st_density_3km` & `st_density_8km` (~15% total importance)
3. `delta_lat` & `dist_north_km` (~11% total importance)

---

## 5. Model Comparison & Production Recommendation

**Production Choice: Random Forest**

1. **Superior High-Risk Recall**: In safety-critical navigation, false negatives in high-risk zones present serious physical danger. Random Forest achieves **54.5% recall on high-risk areas** compared to XGBoost's **36.4%**.
2. **Tabular Stability**: On spatial datasets with 166 regional stations, bagging (Random Forest) reduces variance effectively, whereas gradient boosting (XGBoost) is prone to overfitting localized noise.
3. **Zero Zero-Risk Misclassifications**: In the test set, Random Forest never predicted a high-risk location as "low-risk".
4. **Computational Efficiency**: Both models achieve sub-5ms inference per route, but Random Forest requires no native C++ OpenMP runtime overhead on Windows.

*(SafarixMaps provides a dynamic runtime switcher via `POST /api/ml/select-model` to benchmark either model live).*

---

## 6. How Predictions Reach the Application

1. **Route Calculation**: When the user searches an origin and destination, TomTom routing returns alternative routes.
2. **ML Risk Analysis**: `lib/riskApi.ts` calls `POST http://localhost:8000/api/risk/analyze` with the route coordinates.
3. **Dynamic Segmentation**: The ML engine divides the route into logical segments, computes spatial features for each segment, and runs `predict_proba()` and continuous regression.
4. **Visual Layering**: `useRoute.ts` renders green (`#22c55e`), yellow (`#f59e0b`), or red (`#ef4444`) glow lines along each road segment.
5. **Safest vs Fastest**: Routes are ranked by overall risk and duration, allowing users to toggle between the fastest and safest paths.
6. **Live Navigation HUD**: `useForwardScan.ts` continuously scans 500 meters ahead for high-risk zones, alerting the driver before they enter dangerous sectors.
7. **Safer Route Alternative**: If the active route risk exceeds 30%, `useSaferRoute.ts` evaluates alternate paths and prompts the user with an option to reroute if risk reduction exceeds 20%.
8. **Heatmap Display**: `GET /api/risk/crimes` feeds MapLibre GL with 166 calibrated crime intensity coordinates when the heatmap toggle is activated.

---

## 7. How to Run the Integrated System

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm

### 1. Install Dependencies
```bash
# Frontend dependencies
npm install

# Backend dependencies
pip install -r backend/requirements.txt
```

### 2. Train or Retrain ML Models
To train both Random Forest and XGBoost, run cross-validation, and save artifacts:
```bash
npm run train
# or directly:
python -m backend.app.ml.trainer
```

### 3. Run Backend Test Suite
```bash
npm run test:backend
# or directly:
python -m pytest backend/tests -v
```

### 4. Start the Application
Run both services in separate terminals:

**Terminal 1 — Backend ML Engine (Port 8000):**
```bash
npm run backend
# or directly:
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Frontend Application (Port 3000):**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
API Swagger documentation is accessible at [http://localhost:8000/docs](http://localhost:8000/docs).

---

## 8. Docker Backend Deployment

The FastAPI + ML inference backend is fully containerized using `python:3.11-slim`, dedicated runtime dependencies (`requirements-server.txt`), non-root security execution, and automated Docker health monitoring.

### Prerequisites
- Docker Engine / Docker Desktop 20.10+
- (Optional) Docker Compose

### 1. Build the Docker Image
From the repository root (`SafarixMaps/`):
```bash
docker build -t safarixmaps-backend:latest .
```

### 2. Run the Container
Run in detached mode with port 8000 mapped:
```bash
docker run -d --name safarixmaps-api -p 8000:8000 safarixmaps-backend:latest
```

### 3. Check Container Status & Health Check
Verify the container status and built-in Docker health check:
```bash
# Check status and health indicator
docker ps --filter "name=safarixmaps-api"

# Inspect detailed health check logs
docker inspect --format='{{json .State.Health}}' safarixmaps-api
```
The health check queries `GET /health` every 30 seconds (`--interval=30s --timeout=5s --retries=3`).

### 4. Inspect Container Logs
```bash
docker logs -f safarixmaps-api
```

### 5. Stop and Remove the Container
```bash
# Stop the running container
docker stop safarixmaps-api

# Remove the container
docker rm safarixmaps-api
```

### 6. Service URLs
- **Backend API Base**: [http://localhost:8000](http://localhost:8000)
- **Health Check Endpoint**: [http://localhost:8000/health](http://localhost:8000/health)
- **Interactive Swagger Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc Documentation**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

### 7. Recorded Docker Image Size
Measured via `docker image ls safarixmaps-backend`:
```
IMAGE                        ID             DISK USAGE   CONTENT SIZE
safarixmaps-backend:latest   2a466924ca76   1.91GB       645MB
```

### 8. Frontend Integration with Containerized Backend
The Next.js client seamlessly communicates with the containerized backend:
1. When running the Next.js frontend locally (`npm run dev`) while the backend runs inside Docker (`-p 8000:8000`), port 8000 is exposed to `localhost`. The frontend default (`http://localhost:8000`) works out of the box with zero configuration changes.
2. For custom or production environments, configure the backend API URL in `.env.local`:
   ```env
   NEXT_PUBLIC_RISK_API_URL=http://localhost:8000
   ```
   or in production:
   ```env
   NEXT_PUBLIC_RISK_API_URL=https://api.safarixmaps.yourdomain.com
   ```
   This environment variable is dynamically read by `lib/riskApi.ts` without hardcoding `localhost`.

---

## 9. Saved Artifacts

All training artifacts are versioned in `backend/app/ml/artifacts/`:
- `rf_classifier.joblib`: Trained Random Forest Classifier
- `rf_regressor.joblib`: Trained Random Forest Regressor
- `xgb_classifier.joblib`: Trained XGBoost Classifier
- `xgb_regressor.joblib`: Trained XGBoost Regressor
- `extractor.joblib`: Serialized spatial feature extractor
- `metrics.json`: Complete classification and regression evaluation scores
- `model_comparison.json`: Comparative analysis and selection rationale
- `feature_importance.json`: Feature importance rankings for all models
- `metadata.json`: Dataset cutoffs, training timestamp, and feature lists
- `stations_summary.json`: Police station crime counts and spatial breakdown data

---

## 10. Fallback & Reliability Architecture

- **Missing / Malformed Coordinates**: Handled gracefully with bounds checking and safe fallbacks.
- **Offline Backend**: If the ML service is unreachable, the Next.js frontend safely catches network errors, defaulting to baseline routing without crashing or breaking map rendering.
- **In-Memory Model Singleton**: Loaded once during application startup; zero disk I/O on inference requests guarantees sub-5ms response times.
