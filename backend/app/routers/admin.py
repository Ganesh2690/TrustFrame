from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import EventChannel, EvidenceReport, MediaAsset, UserSession

router = APIRouter(tags=["admin"])


def _require_admin(x_admin_secret: str = Header(...)):
    if x_admin_secret != settings.ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Unauthorized")


class AdminUpload(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    original_filename: str
    sha256_hash: str
    file_size_bytes: int
    mime_type: str
    server_timestamp_utc: datetime
    gps_lat: Optional[float]
    gps_lng: Optional[float]
    event_name: Optional[str]
    session_display_name: Optional[str]


class AdminEvent(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    event_code: str
    name: str
    description: Optional[str]
    created_at: datetime
    asset_count: int


class AdminReport(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    report_url_token: str
    created_at: datetime
    view_count: int
    asset_filename: Optional[str]


class AdminStats(BaseModel):
    total_uploads: int
    total_events: int
    total_reports: int
    total_sessions: int


@router.get("/uploads", response_model=List[AdminUpload], dependencies=[Depends(_require_admin)])
def admin_list_uploads(
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    event_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(MediaAsset)
    if event_id:
        q = q.filter(MediaAsset.event_id == event_id)
    assets = q.order_by(MediaAsset.created_at.desc()).offset(offset).limit(limit).all()

    result = []
    for a in assets:
        result.append(
            AdminUpload(
                id=a.id,
                original_filename=a.original_filename,
                sha256_hash=a.sha256_hash,
                file_size_bytes=a.file_size_bytes,
                mime_type=a.mime_type,
                server_timestamp_utc=a.server_timestamp_utc,
                gps_lat=a.gps_lat,
                gps_lng=a.gps_lng,
                event_name=a.event.name if a.event else None,
                session_display_name=a.session.display_name if a.session else None,
            )
        )
    return result


@router.get("/events", response_model=List[AdminEvent], dependencies=[Depends(_require_admin)])
def admin_list_events(
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    events = (
        db.query(EventChannel)
        .order_by(EventChannel.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [
        AdminEvent(
            id=e.id,
            event_code=e.event_code,
            name=e.name,
            description=e.description,
            created_at=e.created_at,
            asset_count=len(e.assets) if e.assets else 0,
        )
        for e in events
    ]


@router.get("/reports", response_model=List[AdminReport], dependencies=[Depends(_require_admin)])
def admin_list_reports(
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    reports = (
        db.query(EvidenceReport)
        .order_by(EvidenceReport.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [
        AdminReport(
            id=r.id,
            report_url_token=r.report_url_token,
            created_at=r.created_at,
            view_count=r.view_count or 0,
            asset_filename=r.media_asset.original_filename if r.media_asset else None,
        )
        for r in reports
    ]


@router.get("/stats", response_model=AdminStats, dependencies=[Depends(_require_admin)])
def admin_stats(db: Session = Depends(get_db)):
    return AdminStats(
        total_uploads=db.query(MediaAsset).count(),
        total_events=db.query(EventChannel).count(),
        total_reports=db.query(EvidenceReport).count(),
        total_sessions=db.query(UserSession).count(),
    )
