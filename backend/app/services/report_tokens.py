import secrets


def generate_report_token() -> str:
    """Generate a cryptographically secure, URL-safe report token (256-bit entropy)."""
    return secrets.token_urlsafe(32)


def verify_report_token(token: str) -> bool:
    """
    Basic validation that a token has the expected format.
    Tokens are opaque random values; the ground truth lives in the DB.
    """
    if not token:
        return False
    # URL-safe base64 characters only, reasonable length
    allowed = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=")
    return 20 <= len(token) <= 64 and all(c in allowed for c in token)
