from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class EventCreate(BaseModel):
    name: str
    description: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    location_text: Optional[str] = None
    event_datetime: Optional[datetime] = None
    session_id: Optional[str] = None


class EventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    event_code: str
    name: str
    description: Optional[str]
    location_lat: Optional[float]
    location_lng: Optional[float]
    location_text: Optional[str]
    event_datetime: Optional[datetime]
    created_at: datetime
    asset_count: int = 0
    qr_code_url: Optional[str] = None
    event_link: Optional[str] = None


class EventList(BaseModel):
    events: List[EventResponse]
    total: int
