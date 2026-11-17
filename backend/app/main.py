import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.risk import router as risk_router
from .api.ml_routes import router as ml_router
from .ml.inference import RiskInferenceEngine

logger = logging.getLogger("safarixmaps.main")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Load ML models and artifacts
    logger.info("Initializing SafarixMaps ML Inference Engine...")
    engine = RiskInferenceEngine.get_instance()
    if engine.is_loaded:
        logger.info(f"ML Inference Engine ready. Active model: '{engine.active_model_name}'")
    else:
        logger.warning("ML Inference Engine started in fallback mode.")
    yield
    # Shutdown
    logger.info("Shutting down SafarixMaps ML Engine.")

app = FastAPI(
    title="SafarixMaps ML Crime-Risk & Safe Navigation Engine",
    description=(
        "Production-grade Machine Learning backend powering crime-risk prediction, "
        "safe route scoring, and spatial crime heatmap visualization for SafarixMaps using Random Forest and XGBoost."
    ),
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for Next.js frontend (default http://localhost:3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(risk_router)
app.include_router(ml_router)

@app.get("/")
async def root():
    engine = RiskInferenceEngine.get_instance()
    return {
        "service": "SafarixMaps ML Crime-Risk Engine",
        "status": "online",
        "active_model": engine.active_model_name,
        "is_model_loaded": engine.is_loaded,
        "endpoints": {
            "route_analysis": "POST /api/risk/analyze",
            "heatmap_crimes": "GET /api/risk/crimes",
            "point_risk_prediction": "POST /api/risk/predict",
            "ml_metrics": "GET /api/ml/metrics",
            "ml_comparison": "GET /api/ml/comparison",
            "feature_importance": "GET /api/ml/feature-importance",
            "ml_info": "GET /api/ml/info",
            "select_model": "POST /api/ml/select-model",
            "docs": "/docs"
        }
    }

@app.get("/health")
async def health():
    engine = RiskInferenceEngine.get_instance()
    return {
        "status": "healthy",
        "model_loaded": engine.is_loaded,
        "active_model": engine.active_model_name
    }
