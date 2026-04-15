import hashlib
import hmac


def compute_sha256(data: bytes) -> str:
    """Compute SHA-256 hash of raw binary data."""
    return hashlib.sha256(data).hexdigest()


def compute_session_integrity_hash(
    session_id: str,
    server_timestamp: str,
    device_info: str,
    asset_hash: str,
) -> str:
    """
    Compute a composite session integrity hash that binds the upload context
    to the asset.  Input is deterministic and documented so it can be
    independently reconstructed and verified.
    """
    payload = f"{session_id}|{server_timestamp}|{device_info}|{asset_hash}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
