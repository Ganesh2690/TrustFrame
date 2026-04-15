import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from .config import settings
from .database import Base, engine
from .models import CustodyEvent, EventChannel, EvidenceReport, MediaAsset, UserSession  # noqa: F401 – register models
from .routers import admin_router, events_router, reports_router, sessions_router, uploads_router

# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

# Create tables on startup (Alembic migrations preferred in production)
Base.metadata.create_all(bind=engine)

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="TrustFrame API",
    version="1.0.0",
    description="Tamper-proof evidence capture and verification platform",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded media files
app.mount("/static/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# API routers
app.include_router(sessions_router, prefix="/api")
app.include_router(events_router, prefix="/api")
app.include_router(uploads_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(admin_router, prefix="/api/admin")


@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
