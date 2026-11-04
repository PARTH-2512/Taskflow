"""
JWT helpers — sign and verify tokens stored in the httpOnly cookie.

Payload fields:
  sub        — user UUID (string)
  email      — user email
  role       — 'admin' | 'manager' | 'user'
  is_active  — bool (checked on every request so deactivation takes effect quickly)
  iat        — issued-at timestamp
  exp        — expiry timestamp
"""

from datetime import datetime, timedelta, timezone

import jwt
from flask import current_app


def sign_jwt(user: dict) -> str:
    """Create a signed JWT from a user record dict."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user["id"]),
        "email": user["email"],
        "role": user["role"],
        "is_active": user["is_active"],
        "iat": now,
        "exp": now + timedelta(days=current_app.config["JWT_EXPIRY_DAYS"]),
    }
    return jwt.encode(
        payload,
        current_app.config["SECRET_KEY"],
        algorithm=current_app.config["JWT_ALGORITHM"],
    )


def decode_jwt(token: str) -> dict:
    """
    Decode and verify a JWT.
    Raises jwt.ExpiredSignatureError or jwt.InvalidTokenError on failure.
    """
    return jwt.decode(
        token,
        current_app.config["SECRET_KEY"],
        algorithms=[current_app.config["JWT_ALGORITHM"]],
    )

