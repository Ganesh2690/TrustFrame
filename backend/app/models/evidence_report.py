import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from ..database import Base


class EvidenceReport(Base):
    __tablename__ = "evidence_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    media_asset_id = Column(
        UUID(as_uuid=True), ForeignKey("media_assets.id"), nullable=False, unique=True
    )
    report_url_token = Column(String(64), unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_accessed_at = Column(DateTime(timezone=True), nullable=True)
    view_count = Column(Integer, default=0)

    media_asset = relationship("MediaAsset", back_populates="evidence_report")
