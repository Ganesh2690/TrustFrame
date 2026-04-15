import uuid
from datetime import datetime, timezone

from sqlalchemy import BigInteger, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from ..database import Base


class MediaAsset(Base):
    __tablename__ = "media_assets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("event_channels.id"), nullable=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("user_sessions.id"), nullable=False)

    storage_path = Column(String(500), nullable=False)
    sha256_hash = Column(String(64), nullable=False)

    server_timestamp_utc = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    client_timestamp = Column(String(50), nullable=True)

    gps_lat = Column(Float, nullable=True)
    gps_lng = Column(Float, nullable=True)
    gps_address = Column(String(500), nullable=True)

    device_model = Column(String(255), nullable=True)
    os_version = Column(String(255), nullable=True)
    browser = Column(String(512), nullable=True)

    session_integrity_hash = Column(String(64), nullable=True)

    original_filename = Column(String(500), nullable=False)
    file_size_bytes = Column(BigInteger, nullable=False)
    mime_type = Column(String(100), nullable=False)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    duration_seconds = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    event = relationship("EventChannel", back_populates="assets")
    session = relationship("UserSession", back_populates="assets")
    custody_events = relationship("CustodyEvent", back_populates="media_asset", order_by="CustodyEvent.timestamp_utc")
    evidence_report = relationship("EvidenceReport", back_populates="media_asset", uselist=False)
