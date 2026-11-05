"""
Open Pool routes
================

POST  /pool            — create a pool task (admin, manager)
GET   /pool            — list unclaimed pool tasks & current user's claimed pool tasks
POST  /pool/:id/claim  — atomically claim a pool task (role = user, max 3 active)
POST  /pool/:id/release — release a claimed pool task back to the pool
"""

from datetime import datetime
from flask import g, jsonify, request

from ..db import get_db
from ..decorators import require_role
from . import pool_bp


def _format_pool_task(row: dict) -> dict:
    created = row.get("created_at")
    claimed = row.get("claimed_at")
    est = row.get("estimated_hours")

    # Priority to points conversion
    points_map = {1: 5, 2: 10, 3: 20}
    priority = row.get("priority", 2)
    potential_points = points_map.get(priority, 10)

    return {
        "id": str(row["id"]),
        "title": row["title"],
        "description": row.get("description"),
        "status": row["status"],
        "priority": priority,
        "potential_points": potential_points,
        "estimated_hours": float(est) if est is not None else None,
        "created_by": str(row["created_by"]),
        "creator_name": row.get("creator_name"),
        "creator_email": row.get("creator_email"),
        "assigned_to": str(row["assigned_to"]) if row.get("assigned_to") else None,
        "is_pool": True,
        "claimed_at": claimed.isoformat() if isinstance(claimed, datetime) else (str(claimed) if claimed else None),
        "created_at": created.isoformat() if isinstance(created, datetime) else str(created),
    }


# ── Create Pool Task (Admin / Manager) ─────────────────────────────────────

@pool_bp.route("", methods=["POST"])
@require_role("admin", "manager")
def create_pool_task():
    """
    Create an Open Pool task with no initial assignee.
    Users can claim this task from the pool to earn points.
    """
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Title is required"}), 400

    priority = data.get("priority", 2)
    try:
        priority = int(priority)
        if priority not in (1, 2, 3):
            raise ValueError()
    except (TypeError, ValueError):
        return jsonify({"error": "Priority must be 1 (Low), 2 (Medium), or 3 (High)"}), 400

    estimated_hours = data.get("estimated_hours")
    if estimated_hours is not None and estimated_hours != "":
        try:
            estimated_hours = float(estimated_hours)
            if estimated_hours <= 0:
                raise ValueError()
        except ValueError:
            return jsonify({"error": "estimated_hours must be a positive number"}), 400
    else:
        estimated_hours = None

    description = data.get("description")
    creator_id = g.user["sub"]

    db = get_db()
    with db.cursor() as cur:
        cur.execute(
            """
            INSERT INTO tasks (
                title, description, priority, estimated_hours, created_by, assigned_to, is_pool, status
            )
            VALUES (%s, %s, %s, %s, %s, NULL, TRUE, 'pending')
            RETURNING id, title, description, priority, estimated_hours, created_by, assigned_to, is_pool, created_at, claimed_at;
            """,
            (title, description, priority, estimated_hours, creator_id),
        )
        task = cur.fetchone()
        task_id = str(task["id"])

        # Log creation in task_activity
        cur.execute(
            """
            INSERT INTO task_activity (task_id, actor_id, event_type, from_value, to_value)
            VALUES (%s, %s, 'created', NULL, %s);
            """,
            (task_id, creator_id, f"Open Pool Task: {title}"),
        )

        cur.execute(
            """
            SELECT t.*, u.name as creator_name, u.email as creator_email
            FROM tasks t
            JOIN users u ON u.id = t.created_by
            WHERE t.id = %s;
            """,
            (task_id,),
        )
        full_task = cur.fetchone()
        db.commit()

    return jsonify(_format_pool_task(full_task)), 201


# ── List Pool Tasks ────────────────────────────────────────────────────────

@pool_bp.route("", methods=["GET"])
@require_role()
def list_pool():
    """
    Returns:
      - unclaimed: List of unclaimed pool tasks available to claim
      - my_claimed: Tasks claimed by the logged-in user from the pool (still active)
    """
    user_id = g.user["sub"]
    db = get_db()

    with db.cursor() as cur:
        # 1. Unclaimed pool tasks
        cur.execute(
            """
            SELECT t.*, u.name as creator_name, u.email as creator_email
            FROM tasks t
            JOIN users u ON u.id = t.created_by
            WHERE t.is_pool = TRUE AND t.assigned_to IS NULL
            ORDER BY t.priority DESC, t.created_at DESC;
            """
        )
        unclaimed = cur.fetchall()

        # 2. Tasks claimed by this user that are not yet completed
        cur.execute(
            """
            SELECT t.*, u.name as creator_name, u.email as creator_email
            FROM tasks t
            JOIN users u ON u.id = t.created_by
            WHERE t.is_pool = TRUE AND t.assigned_to = %s AND t.status != 'completed'
            ORDER BY t.priority DESC, t.claimed_at DESC;
            """,
            (user_id,),
        )
        my_claimed = cur.fetchall()

    return jsonify({
        "unclaimed": [_format_pool_task(r) for r in unclaimed],
        "my_claimed": [_format_pool_task(r) for r in my_claimed],
        "active_claimed_count": len(my_claimed),
        "max_claim_limit": 3,
    })


# ── Claim Pool Task (User only) ───────────────────────────────────────────

@pool_bp.route("/<uuid:task_id>/claim", methods=["POST"])
@require_role()
def claim_task(task_id):
    """
    Atomically claim an open pool task.
    Enforces:
      - Only users with role 'user' can claim pool tasks
      - Maximum 3 active claimed pool tasks per user
      - Atomic check: WHERE assigned_to IS NULL to prevent race condition
    """
    user_id = g.user["sub"]
    role = g.user["role"]

    if role != "user":
        return jsonify({"error": "Only regular users can claim tasks to earn leaderboard points"}), 403

    db = get_db()
    with db.cursor() as cur:
        # Check active claim count
        cur.execute(
            """
            SELECT COUNT(*) FROM tasks
            WHERE is_pool = TRUE AND assigned_to = %s AND status != 'completed';
            """,
            (user_id,),
        )
        active_count = cur.fetchone()["count"]
        if active_count >= 3:
            return jsonify({
                "error": "You already have 3 active claimed pool tasks. Complete or release one before claiming another."
            }), 400

        # Atomic claim: updates only if is_pool=TRUE and assigned_to IS NULL
        cur.execute(
            """
            UPDATE tasks
            SET assigned_to = %s, claimed_at = NOW(), status = 'in_progress'
            WHERE id = %s AND is_pool = TRUE AND assigned_to IS NULL
            RETURNING *;
            """,
            (user_id, str(task_id)),
        )

        if cur.rowcount == 0:
            return jsonify({
                "error": "This task is no longer available in the pool (it may have just been claimed by someone else)."
            }), 409

        claimed_task = cur.fetchone()

        # Log 'claimed' in task_activity
        cur.execute(
            """
            INSERT INTO task_activity (task_id, actor_id, event_type, from_value, to_value)
            VALUES (%s, %s, 'claimed', 'Open Pool', 'Claimed by User');
            """,
            (str(task_id), user_id),
        )

        cur.execute(
            """
            SELECT t.*, u.name as creator_name, u.email as creator_email
            FROM tasks t
            JOIN users u ON u.id = t.created_by
            WHERE t.id = %s;
            """,
            (str(task_id),),
        )
        full_task = cur.fetchone()
        db.commit()

    return jsonify(_format_pool_task(full_task)), 200


# ── Release Pool Task (User only) ──────────────────────────────────────────

@pool_bp.route("/<uuid:task_id>/release", methods=["POST"])
@require_role()
def release_task(task_id):
    """
    Release a claimed pool task back to the open pool.
    No points are awarded.
    """
    user_id = g.user["sub"]

    db = get_db()
    with db.cursor() as cur:
        cur.execute(
            """
            UPDATE tasks
            SET assigned_to = NULL, claimed_at = NULL, status = 'pending'
            WHERE id = %s AND is_pool = TRUE AND assigned_to = %s AND status != 'completed'
            RETURNING *;
            """,
            (str(task_id), user_id),
        )

        if cur.rowcount == 0:
            return jsonify({
                "error": "Task not found or you cannot release a task you haven't claimed (or already completed)."
            }), 400

        # Log 'released' in task_activity
        cur.execute(
            """
            INSERT INTO task_activity (task_id, actor_id, event_type, from_value, to_value)
            VALUES (%s, %s, 'released', 'Claimed', 'Released back to Open Pool');
            """,
            (str(task_id), user_id),
        )
        db.commit()

    return jsonify({"message": "Task released back to the Open Pool successfully"}), 200

