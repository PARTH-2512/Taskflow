"""
Auth routes
===========

GET  /auth/google     — start Google OAuth flow
GET  /auth/callback   — OAuth callback: upsert user, set JWT cookie, redirect
GET  /auth/me         — return the current user (fresh from DB)
POST /auth/logout     — clear the JWT cookie

Flow
----
1. Browser hits /auth/google → Flask redirects to Google consent screen.
2. Google redirects back to /auth/callback with a one-time code.
3. Flask exchanges the code for tokens, reads the user's Google profile,
   upserts the users table, signs a JWT, sets it as an httpOnly cookie,
   then redirects the browser to the Next.js frontend.
4. Every subsequent API call sends the cookie automatically; the
   require_role decorator validates it on each request.
"""

from flask import current_app, g, jsonify, make_response, redirect, request

from ..auth import auth_bp
from ..db import get_db
from ..decorators import require_role
from ..jwt_utils import sign_jwt
from ..oauth import oauth


# ── Helpers ────────────────────────────────────────────────────────────────


def _set_auth_cookie(response, token: str):
    """Attach the JWT as a secure, httpOnly cookie."""
    is_production = current_app.config["ENV"] == "production"
    response.set_cookie(
        "token",
        token,
        httponly=True,
        secure=is_production,          # HTTPS only in production
        samesite="Lax",                # Lax works for same-site redirects
        max_age=current_app.config["JWT_EXPIRY_DAYS"] * 24 * 60 * 60,
        path="/",
    )
    return response


def _upsert_user(google_id: str, email: str, name: str, avatar_url: str | None) -> dict:
    """
    Insert a new user or refresh name/avatar on an existing one.

    Role assignment rules
    ---------------------
    - New user whose email matches ADMIN_EMAIL → role = 'admin'
    - Every other new user → role = 'user'
    - Returning users: role is NEVER changed here (admin panel owns that).
    """
    db = get_db()
    admin_email = current_app.config["ADMIN_EMAIL"]

    with db.cursor() as cur:
        # Check if the user already exists
        cur.execute("SELECT * FROM users WHERE google_id = %s", (google_id,))
        existing = cur.fetchone()

        if existing is None:
            # First login — determine role
            role = "admin" if email == admin_email else "user"
            cur.execute(
                """
                INSERT INTO users (google_id, email, name, avatar_url, role)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING *
                """,
                (google_id, email, name, avatar_url, role),
            )
        else:
            # Returning user — update display name and avatar only
            cur.execute(
                """
                UPDATE users
                SET name = %s, avatar_url = %s
                WHERE google_id = %s
                RETURNING *
                """,
                (name, avatar_url, google_id),
            )

        user = cur.fetchone()
        db.commit()

    return dict(user)


# ── Routes ─────────────────────────────────────────────────────────────────


@auth_bp.route("/google")
def google_login():
    """Redirect the browser to Google's consent screen."""
    return oauth.google.authorize_redirect(current_app.config["GOOGLE_REDIRECT_URI"])


@auth_bp.route("/callback")
def callback():
    """
    Handle the OAuth callback from Google.

    1. Exchange the authorization code for tokens.
    2. Read the user's Google profile from the ID token (no extra request needed).
    3. Upsert the user record.
    4. Reject deactivated accounts.
    5. Sign a JWT and set it as an httpOnly cookie.
    6. Redirect to the frontend dashboard.
    """
    token = oauth.google.authorize_access_token()

    # Authlib parses the ID token automatically when server_metadata_url is set
    user_info = token.get("userinfo")
    if not user_info:
        # Fallback: fetch from userinfo endpoint
        resp = oauth.google.get("https://www.googleapis.com/oauth2/v3/userinfo")
        user_info = resp.json()

    google_id: str = user_info["sub"]
    email: str = user_info["email"].strip().lower()
    name: str = user_info.get("name") or email
    avatar_url: str | None = user_info.get("picture")

    user = _upsert_user(google_id, email, name, avatar_url)

    if not user["is_active"]:
        # Redirect to frontend with an error flag instead of a JSON 403,
        # because this endpoint is a browser redirect, not an XHR.
        return redirect(current_app.config["FRONTEND_URL"] + "/login?error=deactivated")

    jwt_token = sign_jwt(user)

    response = make_response(redirect(current_app.config["FRONTEND_URL"] + "/dashboard"))
    _set_auth_cookie(response, jwt_token)
    return response


@auth_bp.route("/me")
@require_role()  # any authenticated, active user
def me():
    """
    Return the current user's full profile from the DB.

    Reading from the DB (not just the JWT) ensures that any role or
    is_active changes made via the admin panel are reflected immediately.
    """
    db = get_db()
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT id, email, name, avatar_url, role,
                   is_active, weekly_capacity_hours, created_at
            FROM users
            WHERE id = %s
            """,
            (g.user["sub"],),
        )
        user = cur.fetchone()

    if user is None:
        return jsonify({"error": "User not found"}), 404

    return jsonify(dict(user))


@auth_bp.route("/logout", methods=["POST"])
def logout():
    """Clear the JWT cookie. No auth required — logging out is always allowed."""
    response = jsonify({"message": "Logged out successfully"})
    response.delete_cookie("token", path="/")
    return response

