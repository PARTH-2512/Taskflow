"""
Configuration loaded from environment variables.
Never hard-code secrets — always use a .env file (never committed to git).
"""

import os
from dotenv import load_dotenv

# Load .env from the backend/ directory (or wherever the process starts)
load_dotenv()


def _require(key: str) -> str:
    """Raise an explicit error if a required env var is missing."""
    value = os.environ.get(key)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {key}")
    return value


class Config:
    # Flask
    SECRET_KEY: str = _require("SECRET_KEY")
    ENV: str = os.environ.get("FLASK_ENV", "production")

    # Google OAuth 2.0
    GOOGLE_CLIENT_ID: str = _require("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET: str = _require("GOOGLE_CLIENT_SECRET")
    GOOGLE_REDIRECT_URI: str = os.environ.get(
        "GOOGLE_REDIRECT_URI", "http://localhost:5000/auth/callback"
    )

    # JWT
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_DAYS: int = 7

    # Admin bootstrap — this email gets role='admin' on first login
    ADMIN_EMAIL: str = _require("ADMIN_EMAIL").strip().lower()

    # Database (Supabase Postgres, accessed with service-role credentials)
    DATABASE_URL: str = _require("DATABASE_URL")

    # Frontend URL (used for CORS, links in emails, and post-login redirect)
    FRONTEND_URL: str = os.environ.get("FRONTEND_URL", "http://localhost:3000")

    # ── Gmail API Integration (Phase 5) ───────────────────────────
    # The Gmail address authorized to send notification emails
    GMAIL_SENDER_EMAIL: str | None = os.environ.get("GMAIL_SENDER_EMAIL")
    # OAuth 2.0 refresh token with https://www.googleapis.com/auth/gmail.send scope
    GMAIL_REFRESH_TOKEN: str | None = os.environ.get("GMAIL_REFRESH_TOKEN")
