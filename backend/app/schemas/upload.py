from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class UploadResponse(BaseModel):
    asset_id: UUID
    sha256_hash: str
    report_token: str
    report_url: str
    original_filename: str
    file_size_bytes: int
    mime_type: str


class EventAssociation(BaseModel):
    event_id: str
