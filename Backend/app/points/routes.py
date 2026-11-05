"""
Points and Leaderboard routes
=============================

GET  /points/leaderboard — global rankings of users based on points earned from pool tasks
GET  /points/me          — current user's total points and ledger audit history
"""

from datetime import datetime
from flask import g, jsonify

from ..db import get_db
from ..decorators import require_role
from . import points_bp


@points_bp.route("/leaderboard", methods=["GET"])
@require_role()
def get_leaderboard():
    """
    Returns ranked leaderboard of users who have earned points from pool tasks.
    Ranked by total points descending.
    """
    db = get_db()
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT user_id, name, avatar_url, total_points, rank
            FROM leaderboard
            ORDER BY rank ASC, total_points DESC, name ASC;
            """
        )
        rows = cur.fetchall()

    results = []
    for r in rows:
        results.append({
            "user_id": str(r["user_id"]),
            "name": r["name"],
            "avatar_url": r["avatar_url"],
            "total_points": int(r["total_points"]),
            "rank": int(r["rank"]),
        })

    return jsonify(results)


@points_bp.route("/me", methods=["GET"])
@require_role()
def my_points():
    """
    Returns the current user's total points and full audit history ledger.
    """
    user_id = g.user["sub"]
    db = get_db()

    with db.cursor() as cur:
        # Sum of points
        cur.execute(
            """
            SELECT COALESCE(SUM(points), 0) AS total
            FROM points_ledger
            WHERE user_id = %s;
            """,
            (user_id,),
        )
        total = cur.fetchone()["total"]

        # Points history ledger
        cur.execute(
            """
            SELECT 
                pl.id,
                pl.task_id,
                pl.points,
                pl.reason,
                pl.created_at,
                t.title AS task_title,
                t.priority AS task_priority
            FROM points_ledger pl
            JOIN tasks t ON t.id = pl.task_id
            WHERE pl.user_id = %s
            ORDER BY pl.created_at DESC;
            """,
            (user_id,),
        )
        history = cur.fetchall()

    formatted_history = []
    for h in history:
        dt = h["created_at"]
        formatted_history.append({
            "id": str(h["id"]),
            "task_id": str(h["task_id"]),
            "task_title": h["task_title"],
            "task_priority": h["task_priority"],
            "points": int(h["points"]),
            "reason": h["reason"],
            "created_at": dt.isoformat() if isinstance(dt, datetime) else str(dt),
        })

    return jsonify({
        "total_points": int(total),
        "history": formatted_history,
    })

