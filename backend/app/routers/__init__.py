from .sessions import router as sessions_router
from .events import router as events_router
from .uploads import router as uploads_router
from .reports import router as reports_router
from .admin import router as admin_router

__all__ = ["sessions_router", "events_router", "uploads_router", "reports_router", "admin_router"]
