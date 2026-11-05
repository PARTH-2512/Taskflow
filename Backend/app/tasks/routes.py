"""
Tasks routes
============

POST   /tasks              — create and assign a task (admin, manager)
GET    /tasks              — list tasks scoped by role (admin: all, manager: own created)
GET    /tasks/mine         — priority to-do list for the current user
GET    /tasks/:id          — get single task details
PATCH  /tasks/:id          — edit / reassign task (admin, manager: own created)
PATCH  /tasks/:id/status   — update task status (assignee or admin)
DELETE /tasks/:id          — delete task (admin, manager: own created)
GET    /tasks/:id/activity — activity timeline for a task
"""

from datetime import date, datetime
from flask import g, jsonify, request

from ..db import get_db
from ..decorators import require_role
from ..email import send_task_created_email, send_task_completed_email
from . import tasks_bp


def _format_task(row: dict) -> dict:
    """Format a task database row into JSON-friendly types."""
    due = row.get("due_date")
    if isinstance(due, date):
        due_str = due.isoformat()
        is_overdue = due < date.today() and row.get("status") != "completed"
    else:
        due_str = None
        is_overdue = False

    created = row.get("created_at")
    completed = row.get("completed_at")

    est = row.get("estimated_hours")
    est_float = float(est) if est is not None else None

    return {
        "id": str(row["id"]),
        "title": row["title"],
        "description": row.get("description"),
        "status": row["status"],
        "priority": row["priority"],
        "due_date": due_str,
        "is_overdue": is_overdue,
        "estimated_hours": est_float,
        "created_by": str(row["created_by"]),
        "creator_name": row.get("creator_name"),
        "creator_email": row.get("creator_email"),
        "assigned_to": str(row["assigned_to"]) if row.get("assigned_to") else None,
        "assignee_name": row.get("assignee_name"),
        "assignee_email": row.get("assignee_email"),
        "assignee_avatar": row.get("assignee_avatar"),
        "is_pool": row.get("is_pool", False),
        "created_at": created.isoformat() if isinstance(created, datetime) else str(created),
        "completed_at": completed.isoformat() if isinstance(completed, datetime) else (str(completed) if completed else None),
    }


def _log_activity(cur, task_id: str, actor_id: str, event_type: str, from_val: str = None, to_val: str = None):
    """Insert an entry into the task_activity timeline."""
    cur.execute(
        """
        INSERT INTO task_activity (task_id, actor_id, event_type, from_value, to_value)
        VALUES (%s, %s, %s, %s, %s);
        """,
        (task_id, actor_id, event_type, from_val, to_val),
    )


# ── Create Task ────────────────────────────────────────────────────────────

@tasks_bp.route("", methods=["POST"])
@require_role("admin", "manager")
def create_task():
    """
    Create and assign a task.
    Required fields: title, assigned_to
    Optional: description, priority (1=low, 2=med, 3=high), due_date (YYYY-MM-DD), estimated_hours
    """
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Title is required"}), 400

    assigned_to = data.get("assigned_to")
    if not assigned_to:
        return jsonify({"error": "Assignee (assigned_to) is required"}), 400

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

    due_date = data.get("due_date")
    if due_date:
        try:
            due_date = datetime.strptime(due_date, "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"error": "due_date must be in YYYY-MM-DD format"}), 400
    else:
        due_date = None

    description = data.get("description")

    db = get_db()
    with db.cursor() as cur:
        # Validate assignee exists and is active
        cur.execute("SELECT id, name FROM users WHERE id = %s AND is_active = TRUE", (assigned_to,))
        assignee = cur.fetchone()
        if not assignee:
            return jsonify({"error": "Assignee not found or inactive"}), 404

        creator_id = g.user["sub"]

        cur.execute(
            """
            INSERT INTO tasks (
                title, description, priority, due_date, estimated_hours, created_by, assigned_to, status
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending')
            RETURNING id, title, description, status, priority, due_date, estimated_hours,
                      created_by, assigned_to, is_pool, created_at, completed_at;
            """,
            (title, description, priority, due_date, estimated_hours, creator_id, assigned_to),
        )
        task = cur.fetchone()
        task_id = str(task["id"])

        # Log timeline events
        _log_activity(cur, task_id, creator_id, "created", None, title)
        _log_activity(cur, task_id, creator_id, "assigned", None, assignee["name"])

        # Fetch joined details for response
        cur.execute(
            """
            SELECT 
                t.*,
                c.name AS creator_name, c.email AS creator_email,
                a.name AS assignee_name, a.email AS assignee_email, a.avatar_url AS assignee_avatar
            FROM tasks t
            JOIN users c ON c.id = t.created_by
            LEFT JOIN users a ON a.id = t.assigned_to
            WHERE t.id = %s;
            """,
            (task_id,),
        )
        full_task = cur.fetchone()
        db.commit()

    # Gmail notification to assignee (runs asynchronously in background thread)
    send_task_created_email(full_task)

    return jsonify(_format_task(full_task)), 201


# ── List Tasks (Admin / Manager) ───────────────────────────────────────────

@tasks_bp.route("", methods=["GET"])
@require_role("admin", "manager")
def list_tasks():
    """
    List tasks.
    Admin sees all tasks.
    Manager sees only tasks they created.
    Query params: q, status, priority, assigned_to, sort, order
    """
    role = g.user["role"]
    user_id = g.user["sub"]

    where_clauses = ["t.is_pool = FALSE"]
    params = []

    # Scoping: Manager only sees tasks they created
    if role == "manager":
        where_clauses.append("t.created_by = %s")
        params.append(user_id)

    # Search filter
    q = request.args.get("q", "").strip()
    if q:
        where_clauses.append("(t.title ILIKE %s OR t.description ILIKE %s)")
        params.extend([f"%{q}%", f"%{q}%"])

    # Status filter
    status = request.args.get("status")
    if status in ("pending", "in_progress", "completed"):
        where_clauses.append("t.status = %s")
        params.append(status)

    # Priority filter
    priority = request.args.get("priority")
    if priority in ("1", "2", "3"):
        where_clauses.append("t.priority = %s")
        params.append(int(priority))

    # Assignee filter
    assigned_to = request.args.get("assigned_to")
    if assigned_to:
        where_clauses.append("t.assigned_to = %s")
        params.append(assigned_to)

    # Sorting
    sort_field = request.args.get("sort", "created_at")
    allowed_sorts = {
        "priority": "t.priority",
        "due_date": "t.due_date",
        "created_at": "t.created_at",
        "title": "t.title",
    }
    order_col = allowed_sorts.get(sort_field, "t.created_at")

    order_dir = request.args.get("order", "desc").lower()
    order_dir_sql = "ASC" if order_dir == "asc" else "DESC"

    # NULLS LAST for due_date when sorting asc
    if sort_field == "due_date":
        order_clause = f"{order_col} {order_dir_sql} NULLS LAST"
    else:
        order_clause = f"{order_col} {order_dir_sql}"

    where_sql = " AND ".join(where_clauses)

    query = f"""
        SELECT 
            t.*,
            c.name AS creator_name, c.email AS creator_email,
            a.name AS assignee_name, a.email AS assignee_email, a.avatar_url AS assignee_avatar
        FROM tasks t
        JOIN users c ON c.id = t.created_by
        LEFT JOIN users a ON a.id = t.assigned_to
        WHERE {where_sql}
        ORDER BY {order_clause};
    """

    db = get_db()
    with db.cursor() as cur:
        cur.execute(query, tuple(params))
        rows = cur.fetchall()

    return jsonify([_format_task(r) for r in rows])


# ── My Tasks (Priority To-Do List) ─────────────────────────────────────────

@tasks_bp.route("/mine", methods=["GET"])
@require_role()
def my_tasks():
    """
    To-do list for the logged-in user.
    Sorted by priority (High, Medium, Low), then due date (overdue first),
    with completed tasks placed at the bottom.
    """
    user_id = g.user["sub"]

    db = get_db()
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT 
                t.*,
                c.name AS creator_name, c.email AS creator_email,
                a.name AS assignee_name, a.email AS assignee_email, a.avatar_url AS assignee_avatar
            FROM tasks t
            JOIN users c ON c.id = t.created_by
            LEFT JOIN users a ON a.id = t.assigned_to
            WHERE t.assigned_to = %s
            ORDER BY 
                CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END ASC,
                t.priority DESC,
                t.due_date ASC NULLS LAST,
                t.created_at DESC;
            """,
            (user_id,),
        )
        rows = cur.fetchall()

    return jsonify([_format_task(r) for r in rows])


# ── Get Single Task ────────────────────────────────────────────────────────

@tasks_bp.route("/<uuid:task_id>", methods=["GET"])
@require_role()
def get_task(task_id):
    """Get single task details with visibility rules."""
    db = get_db()
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT 
                t.*,
                c.name AS creator_name, c.email AS creator_email,
                a.name AS assignee_name, a.email AS assignee_email, a.avatar_url AS assignee_avatar
            FROM tasks t
            JOIN users c ON c.id = t.created_by
            LEFT JOIN users a ON a.id = t.assigned_to
            WHERE t.id = %s;
            """,
            (str(task_id),),
        )
        task = cur.fetchone()

    if not task:
        return jsonify({"error": "Task not found"}), 404

    # Permission check
    user_id = g.user["sub"]
    role = g.user["role"]

    is_creator = str(task["created_by"]) == user_id
    is_assignee = task["assigned_to"] and str(task["assigned_to"]) == user_id

    if role != "admin" and not is_creator and not is_assignee and not task["is_pool"]:
        return jsonify({"error": "You do not have permission to view this task"}), 403

    return jsonify(_format_task(task))


# ── Edit / Reassign Task ───────────────────────────────────────────────────

@tasks_bp.route("/<uuid:task_id>", methods=["PATCH"])
@require_role("admin", "manager")
def edit_task(task_id):
    """
    Admin or Manager edits a task.
    Managers can only edit tasks they created.
    """
    user_id = g.user["sub"]
    role = g.user["role"]

    db = get_db()
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT t.*, a.name AS current_assignee_name
            FROM tasks t
            LEFT JOIN users a ON a.id = t.assigned_to
            WHERE t.id = %s;
            """,
            (str(task_id),),
        )
        task = cur.fetchone()

        if not task:
            return jsonify({"error": "Task not found"}), 404

        if role == "manager" and str(task["created_by"]) != user_id:
            return jsonify({"error": "Managers can only edit tasks they created"}), 403

        data = request.get_json(silent=True) or {}
        updates = []
        params = []
        events_to_log = []

        if "title" in data:
            new_title = (data["title"] or "").strip()
            if not new_title:
                return jsonify({"error": "Title cannot be empty"}), 400
            updates.append("title = %s")
            params.append(new_title)

        if "description" in data:
            updates.append("description = %s")
            params.append(data["description"])

        if "priority" in data:
            try:
                p = int(data["priority"])
                if p not in (1, 2, 3):
                    raise ValueError()
                updates.append("priority = %s")
                params.append(p)
            except (ValueError, TypeError):
                return jsonify({"error": "Priority must be 1, 2, or 3"}), 400

        if "due_date" in data:
            due_val = data["due_date"]
            if due_val:
                try:
                    parsed_due = datetime.strptime(due_val, "%Y-%m-%d").date()
                    updates.append("due_date = %s")
                    params.append(parsed_due)
                except ValueError:
                    return jsonify({"error": "due_date must be YYYY-MM-DD"}), 400
            else:
                updates.append("due_date = NULL")

        if "estimated_hours" in data:
            est_val = data["estimated_hours"]
            if est_val is not None and est_val != "":
                try:
                    est_f = float(est_val)
                    if est_f <= 0:
                        raise ValueError()
                    updates.append("estimated_hours = %s")
                    params.append(est_f)
                except ValueError:
                    return jsonify({"error": "estimated_hours must be a positive number"}), 400
            else:
                updates.append("estimated_hours = NULL")

        # Reassign check
        if "assigned_to" in data:
            new_assignee_id = data["assigned_to"]
            if not new_assignee_id:
                return jsonify({"error": "Non-pool tasks must have an assignee"}), 400

            cur.execute("SELECT id, name FROM users WHERE id = %s AND is_active = TRUE", (new_assignee_id,))
            new_assignee = cur.fetchone()
            if not new_assignee:
                return jsonify({"error": "New assignee not found or inactive"}), 404

            if str(task["assigned_to"]) != str(new_assignee_id):
                updates.append("assigned_to = %s")
                params.append(new_assignee_id)
                events_to_log.append((
                    "reassigned",
                    task.get("current_assignee_name") or "Unassigned",
                    new_assignee["name"],
                ))

        if not updates:
            return jsonify({"error": "No update fields provided"}), 400

        # If general fields were updated, log an 'edited' event
        if any(f for f in updates if not f.startswith("assigned_to")):
            events_to_log.append(("edited", None, "Task details updated"))

        params.append(str(task_id))
        cur.execute(
            f"UPDATE tasks SET {', '.join(updates)} WHERE id = %s;",
            tuple(params),
        )

        for ev_type, from_v, to_v in events_to_log:
            _log_activity(cur, str(task_id), user_id, ev_type, from_v, to_v)

        cur.execute(
            """
            SELECT 
                t.*,
                c.name AS creator_name, c.email AS creator_email,
                a.name AS assignee_name, a.email AS assignee_email, a.avatar_url AS assignee_avatar
            FROM tasks t
            JOIN users c ON c.id = t.created_by
            LEFT JOIN users a ON a.id = t.assigned_to
            WHERE t.id = %s;
            """,
            (str(task_id),),
        )
        updated_task = cur.fetchone()
        db.commit()

    return jsonify(_format_task(updated_task))


# ── Update Task Status ─────────────────────────────────────────────────────

@tasks_bp.route("/<uuid:task_id>/status", methods=["PATCH"])
@require_role()
def update_task_status(task_id):
    """
    Update status of a task ('pending', 'in_progress', 'completed').
    Assignee (or admin) can update status.
    """
    user_id = g.user["sub"]
    role = g.user["role"]

    data = request.get_json(silent=True) or {}
    new_status = data.get("status")
    if new_status not in ("pending", "in_progress", "completed"):
        return jsonify({"error": "Invalid status. Must be pending, in_progress, or completed"}), 400

    db = get_db()
    with db.cursor() as cur:
        cur.execute("SELECT * FROM tasks WHERE id = %s;", (str(task_id),))
        task = cur.fetchone()

        if not task:
            return jsonify({"error": "Task not found"}), 404

        is_assignee = task["assigned_to"] and str(task["assigned_to"]) == user_id
        if role != "admin" and not is_assignee:
            return jsonify({"error": "Only the assigned user (or an admin) can update task status"}), 403

        old_status = task["status"]
        if old_status == new_status:
            return jsonify(_format_task(task))

        if new_status == "completed":
            cur.execute(
                """
                UPDATE tasks
                SET status = %s, completed_at = NOW()
                WHERE id = %s
                RETURNING *;
                """,
                (new_status, str(task_id)),
            )
        else:
            cur.execute(
                """
                UPDATE tasks
                SET status = %s, completed_at = NULL
                WHERE id = %s
                RETURNING *;
                """,
                (new_status, str(task_id)),
            )

        # Log timeline events
        _log_activity(cur, str(task_id), user_id, "status_changed", old_status, new_status)
        if new_status == "completed":
            _log_activity(cur, str(task_id), user_id, "completed", None, "Task marked as completed")

            # If this was a claimed Open Pool task, award points in points_ledger
            if task.get("is_pool"):
                priority_pts = {1: 5, 2: 10, 3: 20}
                pts = priority_pts.get(task.get("priority", 2), 10)
                cur.execute(
                    """
                    INSERT INTO points_ledger (user_id, task_id, points, reason)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (user_id, task_id) DO NOTHING;
                    """,
                    (user_id, str(task_id), pts, f"Completed pool task: {task['title']}"),
                )

        cur.execute(
            """
            SELECT 
                t.*,
                c.name AS creator_name, c.email AS creator_email,
                a.name AS assignee_name, a.email AS assignee_email, a.avatar_url AS assignee_avatar
            FROM tasks t
            JOIN users c ON c.id = t.created_by
            LEFT JOIN users a ON a.id = t.assigned_to
            WHERE t.id = %s;
            """,
            (str(task_id),),
        )
        updated = cur.fetchone()
        db.commit()

    # Gmail notification to creator if task was just marked completed
    if new_status == "completed" and old_status != "completed":
        completer_name = g.user.get("name") or g.user.get("email") or "Team Member"
        send_task_completed_email(updated, completer_name)

    return jsonify(_format_task(updated))


# ── Delete Task ────────────────────────────────────────────────────────────

@tasks_bp.route("/<uuid:task_id>", methods=["DELETE"])
@require_role("admin", "manager")
def delete_task(task_id):
    """
    Delete a task.
    Admin can delete any task. Manager can only delete tasks they created.
    """
    user_id = g.user["sub"]
    role = g.user["role"]

    db = get_db()
    with db.cursor() as cur:
        cur.execute("SELECT created_by FROM tasks WHERE id = %s;", (str(task_id),))
        task = cur.fetchone()

        if not task:
            return jsonify({"error": "Task not found"}), 404

        if role == "manager" and str(task["created_by"]) != user_id:
            return jsonify({"error": "Managers can only delete tasks they created"}), 403

        cur.execute("DELETE FROM tasks WHERE id = %s;", (str(task_id),))
        db.commit()

    return jsonify({"message": "Task deleted successfully"}), 200


# ── Task Activity Timeline ─────────────────────────────────────────────────

@tasks_bp.route("/<uuid:task_id>/activity", methods=["GET"])
@require_role()
def task_activity(task_id):
    """Get the immutable audit activity timeline for a task."""
    db = get_db()
    with db.cursor() as cur:
        # Check task exists
        cur.execute("SELECT id, created_by, assigned_to, is_pool FROM tasks WHERE id = %s;", (str(task_id),))
        task = cur.fetchone()
        if not task:
            return jsonify({"error": "Task not found"}), 404

        user_id = g.user["sub"]
        role = g.user["role"]
        is_creator = str(task["created_by"]) == user_id
        is_assignee = task["assigned_to"] and str(task["assigned_to"]) == user_id

        if role != "admin" and not is_creator and not is_assignee and not task["is_pool"]:
            return jsonify({"error": "You do not have permission to view activity on this task"}), 403

        cur.execute(
            """
            SELECT 
                ta.id,
                ta.task_id,
                ta.actor_id,
                ta.event_type,
                ta.from_value,
                ta.to_value,
                ta.created_at,
                u.name AS actor_name,
                u.email AS actor_email,
                u.avatar_url AS actor_avatar
            FROM task_activity ta
            JOIN users u ON u.id = ta.actor_id
            WHERE ta.task_id = %s
            ORDER BY ta.created_at DESC;
            """,
            (str(task_id),),
        )
        activities = cur.fetchall()

    results = []
    for a in activities:
        dt = a["created_at"]
        results.append({
            "id": str(a["id"]),
            "task_id": str(a["task_id"]),
            "actor_id": str(a["actor_id"]),
            "actor_name": a["actor_name"],
            "actor_email": a["actor_email"],
            "actor_avatar": a["actor_avatar"],
            "event_type": a["event_type"],
            "from_value": a["from_value"],
            "to_value": a["to_value"],
            "created_at": dt.isoformat() if isinstance(dt, datetime) else str(dt),
        })

    return jsonify(results)


# ── Comments ───────────────────────────────────────────────────────────────

@tasks_bp.route("/<uuid:task_id>/comments", methods=["GET"])
@require_role()
def get_comments(task_id):
    """Get all comments for a task (sorted oldest first)."""
    db = get_db()
    with db.cursor() as cur:
        # Verify task exists and user has permission
        cur.execute("SELECT id, created_by, assigned_to, is_pool FROM tasks WHERE id = %s;", (str(task_id),))
        task = cur.fetchone()
        if not task:
            return jsonify({"error": "Task not found"}), 404

        user_id = g.user["sub"]
        role = g.user["role"]
        is_creator = str(task["created_by"]) == user_id
        is_assignee = task["assigned_to"] and str(task["assigned_to"]) == user_id

        if role != "admin" and not is_creator and not is_assignee and not task["is_pool"]:
            return jsonify({"error": "You do not have permission to view this task"}), 403

        cur.execute(
            """
            SELECT
                tc.id,
                tc.task_id,
                tc.author_id,
                tc.body,
                tc.created_at,
                u.name AS author_name,
                u.email AS author_email,
                u.avatar_url AS author_avatar
            FROM task_comments tc
            JOIN users u ON u.id = tc.author_id
            WHERE tc.task_id = %s
            ORDER BY tc.created_at ASC;
            """,
            (str(task_id),),
        )
        rows = cur.fetchall()

    results = []
    for c in rows:
        dt = c["created_at"]
        results.append({
            "id": str(c["id"]),
            "task_id": str(c["task_id"]),
            "author_id": str(c["author_id"]),
            "author_name": c["author_name"],
            "author_email": c["author_email"],
            "author_avatar": c["author_avatar"],
            "body": c["body"],
            "created_at": dt.isoformat() if isinstance(dt, datetime) else str(dt),
        })

    return jsonify(results)


@tasks_bp.route("/<uuid:task_id>/comments", methods=["POST"])
@require_role()
def post_comment(task_id):
    """Post a comment on a task."""
    db = get_db()
    with db.cursor() as cur:
        # Verify task exists and user has permission
        cur.execute("SELECT id, created_by, assigned_to, is_pool FROM tasks WHERE id = %s;", (str(task_id),))
        task = cur.fetchone()
        if not task:
            return jsonify({"error": "Task not found"}), 404

        user_id = g.user["sub"]
        role = g.user["role"]
        is_creator = str(task["created_by"]) == user_id
        is_assignee = task["assigned_to"] and str(task["assigned_to"]) == user_id

        if role != "admin" and not is_creator and not is_assignee and not task["is_pool"]:
            return jsonify({"error": "You do not have permission to comment on this task"}), 403

        data = request.get_json(silent=True) or {}
        body = (data.get("body") or "").strip()
        if not body:
            return jsonify({"error": "Comment body cannot be empty"}), 400

        cur.execute(
            """
            INSERT INTO task_comments (task_id, author_id, body)
            VALUES (%s, %s, %s)
            RETURNING id, task_id, author_id, body, created_at;
            """,
            (str(task_id), user_id, body),
        )
        comment = cur.fetchone()

        # Log commented activity
        _log_activity(cur, str(task_id), user_id, "commented", None, body[:100])

        cur.execute(
            """
            SELECT
                tc.id,
                tc.task_id,
                tc.author_id,
                tc.body,
                tc.created_at,
                u.name AS author_name,
                u.email AS author_email,
                u.avatar_url AS author_avatar
            FROM task_comments tc
            JOIN users u ON u.id = tc.author_id
            WHERE tc.id = %s;
            """,
            (str(comment["id"]),),
        )
        full_comment = cur.fetchone()
        db.commit()

    dt = full_comment["created_at"]
    return jsonify({
        "id": str(full_comment["id"]),
        "task_id": str(full_comment["task_id"]),
        "author_id": str(full_comment["author_id"]),
        "author_name": full_comment["author_name"],
        "author_email": full_comment["author_email"],
        "author_avatar": full_comment["author_avatar"],
        "body": full_comment["body"],
        "created_at": dt.isoformat() if isinstance(dt, datetime) else str(dt),
    }), 201

