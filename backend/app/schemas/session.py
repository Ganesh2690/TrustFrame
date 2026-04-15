from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SessionCreate(BaseModel):
    display_name: Optional[str] = None
    phone_number: Optional[str] = None


class SessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    session_id: UUID
    display_name: Optional[str]
    phone_number: Optional[str]
    created_at: datetime
