from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.session import engine, Base
from app.api.v1.api import api_router
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("resqhub")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing ResQHub backend database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database initialized successfully.")
    yield
    logger.info("Shutting down ResQHub backend...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="ResQHub Emergency Safety & Rapid SOS Dispatch Platform API",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)

# CORS Middleware
origins = (
    settings.ALLOWED_ORIGINS.split(",")
    if isinstance(settings.ALLOWED_ORIGINS, str) and settings.ALLOWED_ORIGINS != "*"
    else ["*"]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files & Web Command Portal
static_dir = Path(__file__).resolve().parent / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# Include versioned API router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Root"])
def root(request: Request):
    accept_header = request.headers.get("accept", "")
    index_file = static_dir / "index.html"
    if "text/html" in accept_header and index_file.exists():
        return FileResponse(str(index_file))

    return {
        "name": settings.PROJECT_NAME,
        "version": "1.0.0",
        "documentation": f"{settings.API_V1_STR}/docs",
        "dashboard": "/dashboard",
        "status": "operational",
    }


@app.get("/dashboard", tags=["Root"])
def dashboard():
    index_file = static_dir / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return JSONResponse(status_code=404, content={"message": "Dashboard UI not found"})
