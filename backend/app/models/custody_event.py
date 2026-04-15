import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, JSON, String
from sqlalchemy.dialects.postgresql import UUID

from sqlalchemy.orm import relationship

from ..database import Base

# Custody event types
UPLOAD = "UPLOAD"
REPORT_GENERATED = "REPORT_GENERATED"
REPORT_VIEWED = "REPORT_VIEWED"
EVENT_TAGGED = "EVENT_TAGGED"


class CustodyEvent(Base):
    """Append-only provenance ledger. Records are never updated or deleted."""

    __tablename__ = "custody_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    media_asset_id = Column(
        UUID(as_uuid=True), ForeignKey("media_assets.id"), nullable=False, index=True
    )
    event_type = Column(String(50), nullable=False)
    timestamp_utc = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    meta_data = Column("metadata", JSON, nullable=True)

    media_asset = relationship("MediaAsset", back_populates="custody_events")
