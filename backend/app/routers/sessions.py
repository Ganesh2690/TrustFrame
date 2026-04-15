from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import UserSession
from ..schemas.session import SessionCreate, SessionResponse

router = APIRouter(tags=["sessions"])


@router.post("/session/start", response_model=SessionResponse)
def start_session(payload: SessionCreate, request: Request, db: Session = Depends(get_db)):
    user_agent = request.headers.get("user-agent", "")

    session = UserSession(
        display_name=payload.display_name,
        phone_number=payload.phone_number,
        user_agent=user_agent,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return SessionResponse(
        session_id=session.id,
        display_name=session.display_name,
        phone_number=session.phone_number,
        created_at=session.created_at,
    )
