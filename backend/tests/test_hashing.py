"""Tests for cryptographic hashing functions."""
import hashlib

from app.services.hashing import compute_sha256, compute_session_integrity_hash


def test_sha256_known_value():
    data = b"hello world"
    expected = hashlib.sha256(data).hexdigest()
    assert compute_sha256(data) == expected


def test_sha256_empty_bytes():
    result = compute_sha256(b"")
    assert result == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"


def test_sha256_returns_64_hex_chars():
    result = compute_sha256(b"TrustFrame test data")
    assert len(result) == 64
    assert all(c in "0123456789abcdef" for c in result)


def test_sha256_different_inputs_differ():
    h1 = compute_sha256(b"file_v1")
    h2 = compute_sha256(b"file_v2")
    assert h1 != h2


def test_session_integrity_hash_is_deterministic():
    h1 = compute_session_integrity_hash("sid", "ts", "device", "hash")
    h2 = compute_session_integrity_hash("sid", "ts", "device", "hash")
    assert h1 == h2


def test_session_integrity_hash_changes_with_different_inputs():
    base = compute_session_integrity_hash("sid", "ts", "device", "hash")
    changed_session = compute_session_integrity_hash("sid2", "ts", "device", "hash")
    changed_asset = compute_session_integrity_hash("sid", "ts", "device", "hash2")
    assert base != changed_session
    assert base != changed_asset


def test_session_integrity_hash_returns_64_hex_chars():
    result = compute_session_integrity_hash(
        "a1b2c3d4", "2026-04-08T12:00:00Z", "Win32|10.0|Chrome", "deadbeef" * 8
    )
    assert len(result) == 64
    assert all(c in "0123456789abcdef" for c in result)
