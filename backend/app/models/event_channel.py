import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from ..database import Base


class EventChannel(Base):
    __tablename__ = "event_channels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_code = Column(String(12), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(String(2000), nullable=True)
    location_lat = Column(Float, nullable=True)
    location_lng = Column(Float, nullable=True)
    location_text = Column(String(500), nullable=True)
    event_datetime = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_by_session_id = Column(
        UUID(as_uuid=True), ForeignKey("user_sessions.id"), nullable=True
    )

    creator_session = relationship("UserSession", back_populates="events")
    assets = relationship("MediaAsset", back_populates="event")
