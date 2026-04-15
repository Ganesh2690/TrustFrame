import secrets
import string
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import EventChannel
from ..schemas.event import EventCreate, EventList, EventResponse
from ..services.qr_generator import generate_qr_png

router = APIRouter(tags=["events"])

ALPHABET = string.ascii_uppercase + string.digits


def _make_event_code(length: int = 8) -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(length))


def _to_response(event: EventChannel, db: Session) -> EventResponse:
    asset_count = len(event.assets) if event.assets else 0
    event_link = f"{settings.APP_URL}/capture?event_id={event.event_code}"
    return EventResponse(
        id=event.id,
        event_code=event.event_code,
        name=event.name,
        description=event.description,
        location_lat=event.location_lat,
        location_lng=event.location_lng,
        location_text=event.location_text,
        event_datetime=event.event_datetime,
        created_at=event.created_at,
        asset_count=asset_count,
        qr_code_url=f"/api/events/{event.event_code}/qrcode",
        event_link=event_link,
    )


@router.get("/events", response_model=EventList)
def list_events(db: Session = Depends(get_db)):
    events = db.query(EventChannel).order_by(EventChannel.created_at.desc()).all()
    return EventList(
        events=[_to_response(e, db) for e in events],
        total=len(events),
    )


@router.post("/events", response_model=EventResponse, status_code=201)
def create_event(payload: EventCreate, db: Session = Depends(get_db)):
    # Ensure unique event_code
    for _ in range(10):
        code = _make_event_code()
        if not db.query(EventChannel).filter(EventChannel.event_code == code).first():
            break

    event = EventChannel(
        event_code=code,
        name=payload.name,
        description=payload.description,
        location_lat=payload.location_lat,
        location_lng=payload.location_lng,
        location_text=payload.location_text,
        event_datetime=payload.event_datetime,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return _to_response(event, db)


@router.get("/events/{event_code}", response_model=EventResponse)
def get_event(event_code: str, db: Session = Depends(get_db)):
    event = db.query(EventChannel).filter(EventChannel.event_code == event_code).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return _to_response(event, db)


@router.get("/events/{event_code}/qrcode")
def get_event_qrcode(event_code: str, db: Session = Depends(get_db)):
    event = db.query(EventChannel).filter(EventChannel.event_code == event_code).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    url = f"{settings.APP_URL}/capture?event_id={event.event_code}"
    png = generate_qr_png(url)
    return Response(content=png, media_type="image/png")


@router.get("/app-entry-qrcode")
def get_app_entry_qrcode():
    """QR code that opens the generic upload interface."""
    png = generate_qr_png(settings.APP_URL)
    return Response(content=png, media_type="image/png")
