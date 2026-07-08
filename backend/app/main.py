import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, SessionLocal
from app import models
from app.seed import seed_database
from app.routers import auth, faculty, student
from app.services import llm_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Creating database tables...")
    models.Base.metadata.create_all(bind=engine)

    logger.info("Seeding database with demo users...")
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()

    logger.info("Loading AI models (this may take a moment on first run)...")
    llm_service.load_models()
    logger.info("Startup complete.")

    yield
    # Shutdown (nothing to clean up)


app = FastAPI(
    title="LLM Assignment Portal API",
    description="AI-Powered Assignment Generator and Faculty-Assisted Evaluation Portal",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(faculty.router)
app.include_router(student.router)


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "models_loaded": llm_service._models_loaded,
        "generator_available": llm_service._generator is not None,
        "embedder_available": llm_service._embedder is not None,
    }
