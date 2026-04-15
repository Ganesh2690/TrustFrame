from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import CustodyEvent, EvidenceReport
from ..models.custody_event import REPORT_VIEWED
from ..schemas.report import CustodyEventSchema, EventContext, ReportResponse
from ..services.storage import LocalStorage

router = APIRouter(tags=["reports"])


def _get_storage() -> LocalStorage:
    return LocalStorage(settings.UPLOAD_DIR, settings.MAX_UPLOAD_SIZE_MB)


@router.get("/reports/{token}", response_model=ReportResponse)
def get_report(token: str, db: Session = Depends(get_db)):
    report = (
        db.query(EvidenceReport).filter(EvidenceReport.report_url_token == token).first()
    )
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Update access metadata
    report.last_accessed_at = datetime.now(timezone.utc)
    report.view_count = (report.view_count or 0) + 1

    # Append custody event for view
    db.add(
        CustodyEvent(
            media_asset_id=report.media_asset_id,
            event_type=REPORT_VIEWED,
            meta_data={"report_token": token, "view_count": report.view_count},
        )
    )
    db.commit()
    db.refresh(report)

    asset = report.media_asset
    storage = _get_storage()
    media_url = storage.get_url(asset.storage_path)

    event_ctx = None
    if asset.event:
        event_ctx = EventContext(
            id=asset.event.id,
            event_code=asset.event.event_code,
            name=asset.event.name,
            description=asset.event.description,
            event_link=f"{settings.APP_URL}/capture?event_id={asset.event.event_code}",
        )

    custody_chain = [
        CustodyEventSchema(
            id=c.id,
            event_type=c.event_type,
            timestamp_utc=c.timestamp_utc,
            metadata=c.meta_data,
        )
        for c in asset.custody_events
        if c.event_type != REPORT_VIEWED  # exclude view events from public chain
    ]

    report_url = f"{settings.APP_URL}/reports/{token}"

    return ReportResponse(
        report_id=report.id,
        asset_id=asset.id,
        report_token=token,
        report_url=report_url,
        created_at=report.created_at,
        view_count=report.view_count,
        original_filename=asset.original_filename,
        file_size_bytes=asset.file_size_bytes,
        mime_type=asset.mime_type,
        sha256_hash=asset.sha256_hash,
        media_url=media_url,
        width=asset.width,
        height=asset.height,
        duration_seconds=asset.duration_seconds,
        server_timestamp_utc=asset.server_timestamp_utc,
        client_timestamp=asset.client_timestamp,
        gps_lat=asset.gps_lat,
        gps_lng=asset.gps_lng,
        gps_address=asset.gps_address,
        device_model=asset.device_model,
        os_version=asset.os_version,
        browser=asset.browser,
        event=event_ctx,
        custody_chain=custody_chain,
    )
