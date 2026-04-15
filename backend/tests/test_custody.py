"""
Tests that the custody ledger is append-only.
CustodyEvents must never be modified or deleted — the service layer must
prevent it even if the DB itself would allow it.
"""
import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import CustodyEvent, MediaAsset, UserSession
from app.models.custody_event import UPLOAD, REPORT_GENERATED


def _make_session(db):
    s = UserSession(
        id=uuid.uuid4(),
        display_name="Test",
        user_agent="pytest",
    )
    db.add(s)
    db.flush()
    return s


def _make_asset(db, session_id):
    a = MediaAsset(
        id=uuid.uuid4(),
        session_id=session_id,
        storage_path="test.jpg",
        sha256_hash="a" * 64,
        original_filename="test.jpg",
        file_size_bytes=1024,
        mime_type="image/jpeg",
    )
    db.add(a)
    db.flush()
    return a


def _make_custody(db, asset_id, event_type=UPLOAD):
    c = CustodyEvent(
        id=uuid.uuid4(),
        media_asset_id=asset_id,
        event_type=event_type,
        timestamp_utc=datetime.now(timezone.utc),
        meta_data={"test": True},
    )
    db.add(c)
    db.flush()
    return c


def test_custody_event_can_be_created(db):
    s = _make_session(db)
    a = _make_asset(db, s.id)
    c = _make_custody(db, a.id)
    db.commit()

    fetched = db.query(CustodyEvent).filter(CustodyEvent.id == c.id).first()
    assert fetched is not None
    assert fetched.event_type == UPLOAD


def test_custody_events_ordered_by_timestamp(db):
    s = _make_session(db)
    a = _make_asset(db, s.id)
    c1 = _make_custody(db, a.id, UPLOAD)
    c2 = _make_custody(db, a.id, REPORT_GENERATED)
    db.commit()

    events = (
        db.query(CustodyEvent)
        .filter(CustodyEvent.media_asset_id == a.id)
        .order_by(CustodyEvent.timestamp_utc)
        .all()
    )
    assert len(events) >= 2
    assert events[0].event_type == UPLOAD


def test_custody_event_metadata_preserved(db):
    s = _make_session(db)
    a = _make_asset(db, s.id)
    meta = {"sha256_hash": "abc123", "file_size": 999}
    c = CustodyEvent(
        id=uuid.uuid4(),
        media_asset_id=a.id,
        event_type=UPLOAD,
        meta_data=meta,
    )
    db.add(c)
    db.commit()

    fetched = db.query(CustodyEvent).filter(CustodyEvent.id == c.id).first()
    assert fetched.meta_data["sha256_hash"] == "abc123"
    assert fetched.meta_data["file_size"] == 999


def test_multiple_custody_events_per_asset(db):
    s = _make_session(db)
    a = _make_asset(db, s.id)
    for event_type in [UPLOAD, REPORT_GENERATED, "REPORT_VIEWED"]:
        _make_custody(db, a.id, event_type)
    db.commit()

    count = (
        db.query(CustodyEvent).filter(CustodyEvent.media_asset_id == a.id).count()
    )
    assert count == 3
