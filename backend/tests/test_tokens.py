"""Tests for evidence report token generation and validation."""
from app.services.report_tokens import generate_report_token, verify_report_token


def test_generate_token_is_string():
    token = generate_report_token()
    assert isinstance(token, str)


def test_generate_token_is_url_safe():
    token = generate_report_token()
    allowed = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=")
    assert all(c in allowed for c in token)


def test_generate_token_has_sufficient_length():
    token = generate_report_token()
    # 32 bytes → ~43 base64 chars; at minimum 43
    assert len(token) >= 40


def test_generate_token_unique():
    tokens = {generate_report_token() for _ in range(100)}
    assert len(tokens) == 100  # All unique


def test_verify_valid_token():
    token = generate_report_token()
    assert verify_report_token(token) is True


def test_verify_empty_token():
    assert verify_report_token("") is False


def test_verify_none_token():
    assert verify_report_token(None) is False  # type: ignore


def test_verify_too_short_token():
    assert verify_report_token("abc") is False


def test_verify_invalid_chars():
    assert verify_report_token("token with spaces!") is False
