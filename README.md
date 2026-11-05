# TaskFlow

> Modern team task management and prioritization platform with Google OAuth 2.0, Supabase PostgreSQL, Flask REST API, Next.js (App Router), automated Gmail notifications, Open Pool task gamification, and team workload capacity metrics.

---

## 🏛️ Architecture

```mermaid
flowchart TD
    subgraph Client["Frontend (Next.js 14 App Router + TypeScript + Tailwind CSS)"]
        UI["Modern UI / Responsive Dashboard"]
        Theme["Theme Context (Dark / Light Mode)"]
        AuthContext["Auth Context (Session & Role State)"]
        Polling["Near-Live Polling (15s–30s auto-refresh)"]
    end

    subgraph Server["Backend (Flask 3.x REST API)"]
        AuthRoutes["/auth: Google OAuth 2.0 & JWT Cookie"]
        TaskRoutes["/tasks: Priority To-Do, Assignment & Comments"]
        PoolRoutes["/pool: Open Pool with Atomic Claims"]
        UserRoutes["/users: Workload & Role Access Control"]
        PointsRoutes["/points: Ledger & Leaderboard Rankings"]
        EmailWorker["Background Email Dispatcher"]
    end

    subgraph External["External Services"]
        Supabase[("Supabase PostgreSQL (Tables, Indexes, RLS)")]
        GoogleOAuth["Google Cloud OAuth 2.0"]
        GmailAPI["Gmail API (OAuth2 Refresh Token)"]
    end

    UI --> AuthContext
    AuthContext <-->|"httpOnly JWT (credentials: include)"| AuthRoutes
    UI <-->|"REST API Requests"| Server
    Polling -->|"Silent Auto-Fetch"| Server

    AuthRoutes <-->|"Token Verification"| GoogleOAuth
    Server <-->|"psycopg2 Connection Pool"| Supabase
    EmailWorker -->|"Async Gmail API Calls"| GmailAPI
```

### Architectural Decisions & Design Principles

1. **Security & Authentication via httpOnly Cookie**:
   - Google OAuth 2.0 authorization code flow verifies identity directly with Google.
   - Upon successful verification, the Flask backend issues a signed JWT stored inside an `httpOnly`, `Secure`, `SameSite=Lax` cookie.
   - Prevents client-side Cross-Site Scripting (XSS) token exfiltration; Next.js passes cookies automatically across API requests via `credentials: "include"`.

2. **Role-Based Access Control (RBAC)**:
   - Backend-enforced role verification via `@require_role("admin", "manager")` decorators.
   - **Admin**: Full visibility into all company tasks, user promotion/demotion, account activation/deactivation.
   - **Manager**: Create, assign, edit, and delete tasks they created; review team workload metrics.
   - **User**: Work through personal Priority To-Do list, update task statuses, claim Open Pool tasks, and earn points.

3. **Atomic Task Claiming in Open Pool**:
   - Eliminates race conditions if multiple team members claim a task simultaneously:
     ```sql
     UPDATE tasks
     SET assigned_to = %s, claimed_at = NOW()
     WHERE id = %s AND is_pool = TRUE AND assigned_to IS NULL;
     ```
   - Only succeeds if 1 row is modified; enforces a maximum limit of **3 active claimed tasks** per user.

4. **Points Ledger vs. Stored Counter**:
   - Gamification points are stored in an append-only `points_ledger` table rather than an incremented column on `users`.
   - Guarantees complete auditability, idempotency (`ON CONFLICT DO NOTHING`), and transparent point history.

5. **Dynamic Workload & Capacity Calculation**:
   - Workload is computed on-demand from open tasks and estimated hours:
     - **Available**: `< 60%` of weekly capacity
     - **Busy**: `60% – 100%` of weekly capacity
     - **Overloaded**: `> 100%` of weekly capacity
   - Prevents stale stored counters and provides live capacity warnings during task assignment.

6. **Near-Live Polling Architecture**:
   - Uses silent interval polling (15s–30s) instead of stateful WebSockets, reducing infrastructure overhead and connection dropouts while maintaining fresh task and comment views.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 14 (App Router) + TypeScript | React 18 UI with server/client boundaries |
| **Styling** | Tailwind CSS + Dark Mode | Modern, responsive interface with theme toggling |
| **Backend** | Python 3.13 + Flask | Lightweight, modular RESTful microservice |
| **Authentication** | Google OAuth 2.0 + PyJWT | Secure passwordless OAuth sign-in & JWT sessions |
| **Database** | Supabase (PostgreSQL 15) | Relational database with foreign keys, indexes, and RLS |
| **Email** | Gmail REST API + `google-auth` | Asynchronous email notifications on task creation & completion |
| **Deployment** | Vercel (Frontend) + Render/Railway (Backend) | Production cloud hosting |

---

## ✨ Features Walkthrough

### 1. Authentication & Role Bootstrap
* Sign in with Google using OAuth 2.0.
* Automatic assignment of the **Admin** role for the designated `ADMIN_EMAIL` on first sign-in.
* New accounts default to **User** until promoted by an Admin.
* Deactivated accounts are blocked at login and on every protected API call.

### 2. Task Management & Priority To-Do List
* Tasks include `title`, `description`, `priority` (High, Medium, Low), `due_date`, and `estimated_hours`.
* **Personal To-Do List**: Priority-sorted (High &rarr; Medium &rarr; Low), ordered by due date, with overdue items highlighted.
* Interactive status switcher (`pending` &rarr; `in_progress` &rarr; `completed`).

### 3. Automated Gmail Notifications
* **Task Created**: Assignee receives an email notification with full task details, estimated hours, and due date.
* **Task Completed**: Task creator receives an email confirming task completion.
* Dispatched asynchronously via background worker threads to ensure sub-millisecond API response times.

### 4. Open Pool & Gamified Leaderboard
* Managers and Admins can publish optional, unassigned tasks to the **Open Pool**.
* Standard users can claim up to 3 active pool tasks at a time or release them back to the pool.
* Completing a pool task awards points based on priority (Low: 5, Medium: 10, High: 20).
* **Leaderboard**: Real-time rankings featuring a podium for top 3 champions and a points ledger history.

### 5. Team Workload & Capacity Management
* Team page displays open task counts, active hours, and workload capacity badges (**Available**, **Busy**, **Overloaded**).
* Assignee dropdowns feature inline capacity status to prevent over-allocation.

### 6. Discussion Comments & Activity Audit Timeline
* Threaded comment section on each task page for team queries and status notes.
* Comprehensive audit timeline recording task creation, assignments, reassignments, status transitions, comments, and pool claims.

### 7. Dark / Light Mode & Theme Persistence
* Global theme toggle with smooth CSS color transitions.
* Preferences stored in `localStorage` with fallback to system preferences (`prefers-color-scheme`).

---

## 🗄️ Database Schema (`/migrations`)

```sql
-- Core Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    weekly_capacity_hours NUMERIC(5,2) NOT NULL DEFAULT 40.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tasks Table
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    priority SMALLINT NOT NULL DEFAULT 2 CHECK (priority IN (1, 2, 3)),
    due_date DATE,
    estimated_hours NUMERIC(5,2),
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    is_pool BOOLEAN NOT NULL DEFAULT FALSE,
    claimed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Task Discussion Comments
CREATE TABLE task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Task Activity Timeline
CREATE TABLE task_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    from_value TEXT,
    to_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Points Ledger
CREATE TABLE points_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    points INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, task_id)
);
```

---

## 🚀 Local Development Setup

### Prerequisites
* **Python 3.11+**
* **Node.js 18+** & npm / pnpm
* **Supabase** account (or PostgreSQL instance)
* **Google Cloud Console** project with Google OAuth 2.0 Credentials and Gmail API enabled

---

### 1. Database Setup
1. Create a project in [Supabase](https://supabase.com).
2. Navigate to **SQL Editor** and execute the script in [`migrations/001_initial_schema.sql`](file:///e:/Hair%20Drama/migrations/001_initial_schema.sql).

---

### 2. Backend Setup (Flask)
```bash
cd Backend

# Create & activate virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with your Google OAuth, Supabase DB URI, and Gmail credentials

# (Optional) Generate Gmail refresh token:
python generate_gmail_token.py

# Run the Flask development server
python run.py
# Running on http://localhost:5000
```

---

### 3. Frontend Setup (Next.js)
```bash
cd Frontend

# Install dependencies
npm install

# Configure environment variables
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:5000

# Start development server
npm run dev
# Running on http://localhost:3000
```

---

## 🔒 Environment Variables Reference

See [`.env.example`](file:///.env.example) for the consolidated list:

### Local Development
```env
# Backend (Backend/.env)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/auth/callback
SECRET_KEY=generate-with-python-secrets-token-hex
FLASK_ENV=development
ADMIN_EMAIL=admin@yourcompany.com
DATABASE_URL=postgresql://postgres.xxx:password@pooler.supabase.com:5432/postgres
FRONTEND_URL=http://localhost:3000
GMAIL_SENDER_EMAIL=admin@yourcompany.com
GMAIL_REFRESH_TOKEN=your-gmail-api-refresh-token

# Frontend (Frontend/.env.local)
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### Production Deployment (Vercel + Render)
```env
# Render (Backend Web Service)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://<your-vercel-app>.vercel.app/api/auth/callback
SECRET_KEY=generate-with-python-secrets-token-hex
FLASK_ENV=production
ADMIN_EMAIL=admin@yourcompany.com
DATABASE_URL=postgresql://postgres.xxx:password@pooler.supabase.com:5432/postgres
FRONTEND_URL=https://<your-vercel-app>.vercel.app
GMAIL_SENDER_EMAIL=admin@yourcompany.com
GMAIL_REFRESH_TOKEN=your-gmail-api-refresh-token

# Vercel (Frontend Project Settings)
NEXT_PUBLIC_API_URL=/api
BACKEND_URL=https://<your-render-service>.onrender.com
```

---

## 📋 API Route Reference

### Auth
* `GET /auth/google` — Initiate Google OAuth 2.0 flow
* `GET /auth/callback` — Verify Google authorization code, upsert user, issue JWT cookie
* `GET /auth/me` — Retrieve authenticated user profile
* `POST /auth/logout` — Clear session cookie

### Users (Admin & Team)
* `GET /users` — List active team members with open tasks, hours, and capacity status
* `PATCH /users/:id` — Update role or activate/deactivate account (Admin)

### Tasks
* `POST /tasks` — Create and assign a task (Admin/Manager)
* `GET /tasks` — Scoped task list (Admin: all, Manager: created)
* `GET /tasks/mine` — Personal priority to-do list
* `GET /tasks/:id` — Task details
* `PATCH /tasks/:id` — Edit details or reassign task
* `PATCH /tasks/:id/status` — Update task status (`pending`, `in_progress`, `completed`)
* `DELETE /tasks/:id` — Delete task (Admin/Manager)
* `GET /tasks/:id/activity` — Retrieve immutable audit timeline

### Comments
* `GET /tasks/:id/comments` — Threaded discussion comments
* `POST /tasks/:id/comments` — Add a new comment

### Open Pool & Points
* `POST /pool` — Create open pool task (Admin/Manager)
* `GET /pool` — List available and claimed pool tasks
* `POST /pool/:id/claim` — Atomically claim pool task (User)
* `POST /pool/:id/release` — Release claimed pool task (User)
* `GET /points/leaderboard` — Global points leaderboard ranking
* `GET /points/me` — Current user points and completion ledger

---

## 📄 License
MIT License. Built for Hair Drama Tech Assignment.

