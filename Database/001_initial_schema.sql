-- ============================================================
-- TaskFlow — Initial Database Schema
-- Migration: 001_initial_schema.sql
-- Database:  Supabase (PostgreSQL 15+)
-- ============================================================
-- Notes:
--   • RLS is enabled on every table with NO policies.
--     Flask connects with the Supabase service-role key, which
--     bypasses RLS. If a frontend client ever queries directly,
--     add policies then.
--   • gen_random_uuid() is built-in to PG 13+; no extension needed.
--   • Users are deactivated, never deleted, so FK actions are
--     RESTRICT to protect audit trails and task history.
-- ============================================================

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE user_role AS ENUM ('admin', 'manager', 'user');

CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed');

CREATE TYPE activity_event_type AS ENUM (
    'created',
    'assigned',
    'reassigned',
    'edited',
    'status_changed',
    'claimed',
    'released',
    'completed',
    'commented'
);

-- ============================================================
-- 1. USERS
-- ============================================================
-- Stores every person who has logged in via Google OAuth.
-- Role defaults to 'user'; admin set via ADMIN_EMAIL env, manager/admin promoted by an admin.
-- Deactivated users (is_active = false) are blocked at login.
-- Note: Lowercase emails in Flask before INSERT/lookup.

CREATE TABLE users (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_id             VARCHAR(255) NOT NULL UNIQUE,
    email                 VARCHAR(320) NOT NULL UNIQUE,
    name                  VARCHAR(255) NOT NULL,
    avatar_url            TEXT,
    role                  user_role NOT NULL DEFAULT 'user',
    is_active             BOOLEAN NOT NULL DEFAULT TRUE,
    weekly_capacity_hours NUMERIC(5, 2) NOT NULL DEFAULT 40.00,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- UNIQUE constraints already create indexes on google_id and email.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. TASKS
-- ============================================================
-- Central table. Priority stored as integer (1=Low, 2=Medium,
-- 3=High) so ORDER BY priority DESC sorts correctly.
-- Pool tasks have is_pool = TRUE and assigned_to = NULL until
-- claimed. After claiming, is_pool stays TRUE and assigned_to
-- is set; unclaimed = assigned_to IS NULL.

CREATE TABLE tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    status          task_status NOT NULL DEFAULT 'pending',
    priority        SMALLINT NOT NULL DEFAULT 2
                        CHECK (priority BETWEEN 1 AND 3),
    due_date        DATE,
    estimated_hours NUMERIC(6, 2)
                        CHECK (estimated_hours IS NULL OR estimated_hours > 0),
    created_by      UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    assigned_to     UUID REFERENCES users (id) ON DELETE RESTRICT,
    is_pool         BOOLEAN NOT NULL DEFAULT FALSE,
    claimed_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,

    -- Non-pool tasks must always have an assignee
    CONSTRAINT chk_non_pool_has_assignee CHECK (is_pool OR assigned_to IS NOT NULL),
    -- claimed_at only makes sense for pool tasks
    CONSTRAINT chk_claimed_at_pool_only  CHECK (claimed_at IS NULL OR is_pool)
);

-- Fast lookups for a user's to-do list (assigned tasks by status)
CREATE INDEX idx_tasks_assigned_status ON tasks (assigned_to, status);

-- Fast lookups for open pool tasks
CREATE INDEX idx_tasks_pool ON tasks (is_pool, assigned_to)
    WHERE is_pool = TRUE;

-- Manager view: tasks created by a specific user
CREATE INDEX idx_tasks_created_by ON tasks (created_by);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. TASK_ACTIVITY
-- ============================================================
-- Immutable audit log / timeline of every event on a task.
-- from_value and to_value store the old and new state as text
-- (e.g., status change: "pending" → "in_progress").

CREATE TABLE task_activity (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     UUID NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    actor_id    UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    event_type  activity_event_type NOT NULL,
    from_value  TEXT,
    to_value    TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Timeline for a single task, newest first
CREATE INDEX idx_task_activity_task ON task_activity (task_id, created_at DESC);

ALTER TABLE task_activity ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. TASK_COMMENTS
-- ============================================================
-- Comment thread per task for queries / discussions.

CREATE TABLE task_comments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     UUID NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    author_id   UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comments for a single task, oldest first
CREATE INDEX idx_task_comments_task ON task_comments (task_id, created_at ASC);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. POINTS_LEDGER
-- ============================================================
-- Append-only ledger. A user's total points = SUM(points).
-- This avoids update anomalies (no stored counter to drift).

CREATE TABLE points_ledger (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    task_id     UUID NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    points      INTEGER NOT NULL CHECK (points > 0),
    reason      VARCHAR(255),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Leaderboard: sum points per user
CREATE INDEX idx_points_ledger_user ON points_ledger (user_id);

-- Prevent double-awarding points for the same task to the same user
CREATE UNIQUE INDEX idx_points_ledger_unique_award ON points_ledger (user_id, task_id);

ALTER TABLE points_ledger ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- VIEWS
-- ============================================================
-- security_invoker = true means the view runs with the
-- permissions of the querying user, not the view owner.
-- This ensures RLS policies (if added later) are respected.

-- View: User workload — open tasks count, open hours, capacity status
CREATE OR REPLACE VIEW user_workload
    WITH (security_invoker = true)
AS
SELECT
    u.id                AS user_id,
    u.name,
    u.email,
    u.weekly_capacity_hours,
    COUNT(t.id)         AS open_tasks,
    COALESCE(SUM(t.estimated_hours), 0) AS open_hours,
    CASE
        WHEN COALESCE(SUM(t.estimated_hours), 0) > u.weekly_capacity_hours
            THEN 'overloaded'
        WHEN COALESCE(SUM(t.estimated_hours), 0) >= u.weekly_capacity_hours * 0.6
            THEN 'busy'
        ELSE 'available'
    END                 AS capacity_status
FROM users u
LEFT JOIN tasks t
    ON t.assigned_to = u.id
    AND t.status != 'completed'
WHERE u.is_active = TRUE
GROUP BY u.id, u.name, u.email, u.weekly_capacity_hours;

-- View: Leaderboard — total points per user, ranked
-- Filtered to role = 'user' since only users earn pool points.
CREATE OR REPLACE VIEW leaderboard
    WITH (security_invoker = true)
AS
SELECT
    u.id        AS user_id,
    u.name,
    u.avatar_url,
    COALESCE(SUM(pl.points), 0) AS total_points,
    RANK() OVER (ORDER BY COALESCE(SUM(pl.points), 0) DESC) AS rank
FROM users u
LEFT JOIN points_ledger pl ON pl.user_id = u.id
WHERE u.is_active = TRUE
  AND u.role = 'user'
GROUP BY u.id, u.name, u.avatar_url;
