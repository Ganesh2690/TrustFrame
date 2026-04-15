import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import CustodyEvent, EventChannel, EvidenceReport, MediaAsset, UserSession
from ..models.custody_event import EVENT_TAGGED, REPORT_GENERATED, UPLOAD
from ..schemas.upload import EventAssociation, UploadResponse
from ..services.hashing import compute_session_integrity_hash
from ..services.report_tokens import generate_report_token
from ..services.storage import LocalStorage

router = APIRouter(tags=["uploads"])

ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/heic",
    "image/heif",
    "video/mp4",
    "video/quicktime",
}


def _get_storage() -> LocalStorage:
    return LocalStorage(settings.UPLOAD_DIR, settings.MAX_UPLOAD_SIZE_MB)


def _try_get_image_dimensions(storage_path: str) -> tuple:
    """Attempt to extract width/height using Pillow for image files."""
    abs_path = os.path.join(settings.UPLOAD_DIR, storage_path)
    try:
        from PIL import Image

        with Image.open(abs_path) as img:
            return img.width, img.height
    except Exception:
        return None, None


@router.post("/uploads", response_model=UploadResponse, status_code=201)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    session_id: str = Form(...),
    client_timestamp: Optional[str] = Form(None),
    gps_lat: Optional[float] = Form(None),
    gps_lng: Optional[float] = Form(None),
    gps_address: Optional[str] = Form(None),
    device_model: Optional[str] = Form(None),
    os_version: Optional[str] = Form(None),
    browser: Optional[str] = Form(None),
    event_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    # Validate session
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session_id")

    session = db.query(UserSession).filter(UserSession.id == session_uuid).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Validate MIME type
    content_type = file.content_type or ""
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {content_type}. Allowed: JPEG, PNG, HEIC, MP4, MOV",
        )

    # Save file + hash
    storage = _get_storage()
    try:
        storage_name, sha256_hash, file_size = await storage.save(file, content_type)
    except ValueError as exc:
        raise HTTPException(status_code=413, detail=str(exc))

    server_ts = datetime.now(timezone.utc)

    # Extract image dimensions
    width, height = None, None
    if content_type.startswith("image/"):
        width, height = _try_get_image_dimensions(storage_name)

    # Session integrity hash
    device_info = f"{device_model or ''}|{os_version or ''}|{browser or ''}"
    integrity_hash = compute_session_integrity_hash(
        str(session_uuid),
        server_ts.isoformat(),
        device_info,
        sha256_hash,
    )

    # Resolve optional event
    event_uuid = None
    if event_id:
        try:
            # event_id can be a UUID or event_code
            try:
                event_uuid_candidate = uuid.UUID(event_id)
                ev = db.query(EventChannel).filter(EventChannel.id == event_uuid_candidate).first()
            except ValueError:
                ev = db.query(EventChannel).filter(EventChannel.event_code == event_id).first()
            if ev:
                event_uuid = ev.id
        except Exception:
            pass

    # Create MediaAsset
    asset = MediaAsset(
        session_id=session_uuid,
        event_id=event_uuid,
        storage_path=storage_name,
        sha256_hash=sha256_hash,
        server_timestamp_utc=server_ts,
        client_timestamp=client_timestamp,
        gps_lat=gps_lat,
        gps_lng=gps_lng,
        gps_address=gps_address,
        device_model=device_model,
        os_version=os_version,
        browser=browser or request.headers.get("user-agent", ""),
        session_integrity_hash=integrity_hash,
        original_filename=file.filename or "upload",
        file_size_bytes=file_size,
        mime_type=content_type,
        width=width,
        height=height,
    )
    db.add(asset)
    db.flush()

    # Initial custody event (UPLOAD)
    custody = CustodyEvent(
        media_asset_id=asset.id,
        event_type=UPLOAD,
        timestamp_utc=server_ts,
        meta_data={
            "session_id": str(session_uuid),
            "sha256_hash": sha256_hash,
            "file_size_bytes": file_size,
            "original_filename": file.filename,
            "mime_type": content_type,
        },
    )
    db.add(custody)
    db.flush()

    # Evidence report record
    token = generate_report_token()
    report = EvidenceReport(
        media_asset_id=asset.id,
        report_url_token=token,
    )
    db.add(report)

    # Custody: REPORT_GENERATED
    db.add(
        CustodyEvent(
            media_asset_id=asset.id,
            event_type=REPORT_GENERATED,
            timestamp_utc=datetime.now(timezone.utc),
            meta_data={"report_token": token},
        )
    )

    db.commit()

    report_url = f"{settings.APP_URL}/reports/{token}"
    return UploadResponse(
        asset_id=asset.id,
        sha256_hash=sha256_hash,
        report_token=token,
        report_url=report_url,
        original_filename=asset.original_filename,
        file_size_bytes=file_size,
        mime_type=content_type,
    )


@router.patch("/uploads/{asset_id}/event", status_code=200)
def associate_event(
    asset_id: str,
    payload: EventAssociation,
    db: Session = Depends(get_db),
):
    try:
        asset_uuid = uuid.UUID(asset_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid asset_id")

    asset = db.query(MediaAsset).filter(MediaAsset.id == asset_uuid).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # Resolve event by UUID or event_code
    try:
        event_uuid = uuid.UUID(payload.event_id)
        event = db.query(EventChannel).filter(EventChannel.id == event_uuid).first()
    except ValueError:
        event = db.query(EventChannel).filter(EventChannel.event_code == payload.event_id).first()

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    asset.event_id = event.id
    db.add(
        CustodyEvent(
            media_asset_id=asset.id,
            event_type=EVENT_TAGGED,
            meta_data={"event_id": str(event.id), "event_code": event.event_code, "event_name": event.name},
        )
    )
    db.commit()
    return {"status": "ok", "event_id": str(event.id), "event_name": event.name}
