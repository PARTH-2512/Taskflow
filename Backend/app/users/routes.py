"""
Users routes
============

GET    /users         — list active users with workload stats (admin, manager)
PATCH  /users/:id     — update user role or active status (admin only)
DELETE /users/:id     — deactivate user (admin only)
"""

from flask import g, jsonify, request
from ..db import get_db
from ..decorators import require_role
from . import users_bp


@users_bp.route("", methods=["GET"])
@require_role("admin", "manager")
def list_users():
    """
    List all active users for dropdowns, task assignments, and workload views.
    Includes current open task count, total open hours, and capacity status.
    """
    db = get_db()
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT 
                u.id,
                u.email,
                u.name,
                u.avatar_url,
                u.role,
                u.is_active,
                u.weekly_capacity_hours,
                COALESCE(w.open_tasks, 0) AS open_tasks,
                COALESCE(w.open_hours, 0) AS open_hours,
                COALESCE(w.capacity_status, 'available') AS capacity_status
            FROM users u
            LEFT JOIN user_workload w ON w.user_id = u.id
            WHERE u.is_active = TRUE
            ORDER BY u.name ASC;
            """
        )
        users = cur.fetchall()

    result = []
    for u in users:
        result.append({
            "id": str(u["id"]),
            "email": u["email"],
            "name": u["name"],
            "avatar_url": u["avatar_url"],
            "role": u["role"],
            "is_active": u["is_active"],
            "weekly_capacity_hours": float(u["weekly_capacity_hours"]),
            "open_tasks": int(u["open_tasks"]),
            "open_hours": float(u["open_hours"]),
            "capacity_status": u["capacity_status"],
        })

    return jsonify(result)


@users_bp.route("/<uuid:user_id>", methods=["PATCH"])
@require_role("admin")
def update_user(user_id):
    """
    Admin updates a user's role or active status.
    Body may contain:
      - role: 'admin' | 'manager' | 'user'
      - is_active: bool
      - weekly_capacity_hours: float
    """
    data = request.get_json(silent=True) or {}
    allowed_roles = {"admin", "manager", "user"}

    updates = []
    params = []

    if "role" in data:
        role = data["role"]
        if role not in allowed_roles:
            return jsonify({"error": f"Invalid role. Must be one of: {', '.join(allowed_roles)}"}), 400
        updates.append("role = %s")
        params.append(role)

    if "is_active" in data:
        updates.append("is_active = %s")
        params.append(bool(data["is_active"]))

    if "weekly_capacity_hours" in data:
        try:
            cap = float(data["weekly_capacity_hours"])
            if cap <= 0:
                raise ValueError()
            updates.append("weekly_capacity_hours = %s")
            params.append(cap)
        except ValueError:
            return jsonify({"error": "weekly_capacity_hours must be a positive number"}), 400

    if not updates:
        return jsonify({"error": "No valid fields provided to update"}), 400

    db = get_db()
    with db.cursor() as cur:
        query = f"""
            UPDATE users
            SET {", ".join(updates)}
            WHERE id = %s
            RETURNING id, email, name, avatar_url, role, is_active, weekly_capacity_hours;
        """
        params.append(str(user_id))
        cur.execute(query, tuple(params))
        updated = cur.fetchone()

        if not updated:
            return jsonify({"error": "User not found"}), 404

        db.commit()

    return jsonify({
        "id": str(updated["id"]),
        "email": updated["email"],
        "name": updated["name"],
        "avatar_url": updated["avatar_url"],
        "role": updated["role"],
        "is_active": updated["is_active"],
        "weekly_capacity_hours": float(updated["weekly_capacity_hours"]),
    })


@users_bp.route("/<uuid:user_id>", methods=["DELETE"])
@require_role("admin")
def deactivate_user(user_id):
    """
    Admin soft-deactivates a user. Foreign keys are preserved so audit trails remain valid.
    """
    if str(user_id) == str(g.user["sub"]):
        return jsonify({"error": "You cannot deactivate your own admin account"}), 400

    db = get_db()
    with db.cursor() as cur:
        cur.execute(
            """
            UPDATE users
            SET is_active = FALSE
            WHERE id = %s
            RETURNING id;
            """,
            (str(user_id),)
        )
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "User not found"}), 404
        db.commit()

    return jsonify({"message": "User deactivated successfully"})

