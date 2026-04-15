from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CustodyEventSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    event_type: str
    timestamp_utc: datetime
    metadata: Optional[dict] = None


class EventContext(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    event_code: str
    name: str
    description: Optional[str]
    event_link: Optional[str]


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    report_id: UUID
    asset_id: UUID
    report_token: str
    report_url: str
    created_at: datetime
    view_count: int

    # Media info
    original_filename: str
    file_size_bytes: int
    mime_type: str
    sha256_hash: str
    media_url: str
    width: Optional[int]
    height: Optional[int]
    duration_seconds: Optional[float]

    # Timestamps
    server_timestamp_utc: datetime
    client_timestamp: Optional[str]

    # Location
    gps_lat: Optional[float]
    gps_lng: Optional[float]
    gps_address: Optional[str]

    # Device
    device_model: Optional[str]
    os_version: Optional[str]
    browser: Optional[str]

    # Event context
    event: Optional[EventContext]

    # Custody chain
    custody_chain: List[CustodyEventSchema]
