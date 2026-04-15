"""Initial schema: all TrustFrame tables

Revision ID: 001
Revises: 
Create Date: 2026-04-08
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("display_name", sa.String(255), nullable=True),
        sa.Column("phone_number", sa.String(50), nullable=True),
        sa.Column("user_agent", sa.String(512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "event_channels",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("event_code", sa.String(12), unique=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.String(2000), nullable=True),
        sa.Column("location_lat", sa.Float, nullable=True),
        sa.Column("location_lng", sa.Float, nullable=True),
        sa.Column("location_text", sa.String(500), nullable=True),
        sa.Column("event_datetime", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_by_session_id",
            UUID(as_uuid=True),
            sa.ForeignKey("user_sessions.id"),
            nullable=True,
        ),
    )
    op.create_index("ix_event_channels_event_code", "event_channels", ["event_code"])

    op.create_table(
        "media_assets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("event_id", UUID(as_uuid=True), sa.ForeignKey("event_channels.id"), nullable=True),
        sa.Column("session_id", UUID(as_uuid=True), sa.ForeignKey("user_sessions.id"), nullable=False),
        sa.Column("storage_path", sa.String(500), nullable=False),
        sa.Column("sha256_hash", sa.String(64), nullable=False),
        sa.Column("server_timestamp_utc", sa.DateTime(timezone=True), nullable=False),
        sa.Column("client_timestamp", sa.String(50), nullable=True),
        sa.Column("gps_lat", sa.Float, nullable=True),
        sa.Column("gps_lng", sa.Float, nullable=True),
        sa.Column("gps_address", sa.String(500), nullable=True),
        sa.Column("device_model", sa.String(255), nullable=True),
        sa.Column("os_version", sa.String(255), nullable=True),
        sa.Column("browser", sa.String(512), nullable=True),
        sa.Column("session_integrity_hash", sa.String(64), nullable=True),
        sa.Column("original_filename", sa.String(500), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger, nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("width", sa.Integer, nullable=True),
        sa.Column("height", sa.Integer, nullable=True),
        sa.Column("duration_seconds", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "custody_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "media_asset_id",
            UUID(as_uuid=True),
            sa.ForeignKey("media_assets.id"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("timestamp_utc", sa.DateTime(timezone=True), nullable=False),
        sa.Column("metadata", JSONB, nullable=True),
    )
    op.create_index("ix_custody_events_media_asset_id", "custody_events", ["media_asset_id"])

    op.create_table(
        "evidence_reports",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "media_asset_id",
            UUID(as_uuid=True),
            sa.ForeignKey("media_assets.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column("report_url_token", sa.String(64), unique=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_accessed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("view_count", sa.Integer, default=0),
    )
    op.create_index("ix_evidence_reports_token", "evidence_reports", ["report_url_token"])


def downgrade() -> None:
    op.drop_table("evidence_reports")
    op.drop_table("custody_events")
    op.drop_table("media_assets")
    op.drop_table("event_channels")
    op.drop_table("user_sessions")
