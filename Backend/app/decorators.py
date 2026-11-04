"""
Route decorators.

@require_role()               — any authenticated, active user
@require_role("admin")        — admin only
@require_role("admin","manager") — admin or manager

The decoded JWT payload is stored in Flask's g.user so route handlers
can read g.user["sub"], g.user["role"], etc. without hitting the DB.
"""

from functools import wraps

import jwt
from flask import g, jsonify, request

from .jwt_utils import decode_jwt


def _extract_token() -> str | None:
    return request.cookies.get("token")


def require_role(*roles: str):
    """
    Decorator factory.

    Usage
    -----
    @require_role()                    # authenticated only (any role)
    @require_role("admin")             # admin only
    @require_role("admin", "manager")  # admin or manager
    """

    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            token = _extract_token()
            if not token:
                return jsonify({"error": "Authentication required"}), 401

            try:
                payload = decode_jwt(token)
            except jwt.ExpiredSignatureError:
                return jsonify({"error": "Session expired — please log in again"}), 401
            except jwt.InvalidTokenError:
                return jsonify({"error": "Invalid token"}), 401

            if not payload.get("is_active"):
                return jsonify({"error": "Your account has been deactivated"}), 403

            if roles and payload["role"] not in roles:
                return jsonify({"error": "Insufficient permissions"}), 403

            # Make the payload available to the route handler
            g.user = payload
            return f(*args, **kwargs)

        return wrapped

    return decorator

