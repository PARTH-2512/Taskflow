"""
Database helpers.

Flask's application context (g) holds one psycopg2 connection per request.
Using RealDictCursor means every row comes back as a plain dict — no index
gymnastics required.

The service-role DATABASE_URL bypasses Supabase RLS so Flask has full access.
"""

import psycopg2
import psycopg2.extras
from flask import current_app, g


def get_db() -> psycopg2.extensions.connection:
    """Return (or create) the per-request DB connection."""
    if "db" not in g:
        g.db = psycopg2.connect(
            current_app.config["DATABASE_URL"],
            cursor_factory=psycopg2.extras.RealDictCursor,
        )
    return g.db


def close_db(exception=None) -> None:
    """Called automatically by Flask at the end of every request context."""
    db = g.pop("db", None)
    if db is not None:
        db.close()

