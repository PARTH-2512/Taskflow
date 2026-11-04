# TaskFlow: Exact Idea (Hairdrama Tech Assignment)

> Working name: TaskFlow. Rename anything. Rewrite sections in your own words before the interview.

---

## 0. MANDATORY CHECKLIST (do not forget these)

These come straight from the assignment. Everything else is bonus.

**Product**
- [ ] Sign up and log in with **Google OAuth 2.0** (Gmail accounts)
- [ ] Users can **create tasks**
- [ ] Users can **assign tasks** to other users
- [ ] **Gmail email** when a task is **created** and when it is **completed**

**Stack (fixed)**
- [ ] Database: **Supabase**
- [ ] Backend: **Flask**
- [ ] Frontend: **Next.js + TypeScript**
- [ ] Email: **Gmail** integration
- [ ] Login: **OAuth 2.0 with Google**

**Delivery**
- [ ] Deployed to production (Vercel + Railway/Render + Supabase) with a **working live URL**
- [ ] GitHub repo: **clean commit history**, `/migrations` folder, `.env.example`
- [ ] README with an **Architecture** section
- [ ] **Loom video** walking through ALL the code and features
- [ ] Submission form filled with the live URL

**Rules**
- [ ] Do NOT fully AI-generate the app. Write it yourself; use AI for snippets and ideas only.
- [ ] Be able to explain every module in the interview.
- [ ] No bugs on the live app; test every feature after deploy.
- [ ] Eligibility: the internship is for final-semester or completed students. Confirm you qualify before investing time.

---

## 1. Overview

A task management app with three roles. Managers create and assign tasks. Users work through a priority-sorted to-do list and share status updates. A separate **Open Pool** holds optional tasks that users can claim to earn **points**. Admins manage people and see everything.

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS |
| Backend | Flask (Python), Authlib for OAuth, PyJWT |
| Database | Supabase (Postgres), accessed from Flask |
| Email | Gmail API (one app Gmail account, refresh token) |
| Auth | Google OAuth 2.0, JWT in httpOnly cookie |
| Deploy | Vercel (frontend), Render/Railway (Flask), Supabase (DB) |

---

## 3. Roles and Permissions

| Action | Admin | Manager | User |
|---|:-:|:-:|:-:|
| Login with Google | ✅ | ✅ | ✅ |
| Manage users: change roles | ✅ | ❌ | ❌ |
| Activate / deactivate / delete users | ✅ | ❌ | ❌ |
| View all tasks | ✅ | ❌ | ❌ |
| View tasks they created | ✅ | ✅ | ❌ |
| Create and assign tasks | ✅ | ✅ | ❌ |
| Edit / reassign / delete tasks | ✅ | ✅ (own) | ❌ |
| Create Open Pool tasks | ✅ | ✅ | ❌ |
| See own to-do list | ✅ | ✅ | ✅ |
| Update status of tasks assigned to them | ✅ | ✅ | ✅ |
| Post query/comment on a task | ✅ | ✅ | ✅ |
| Claim Open Pool tasks and earn points | ❌ | ❌ | ✅ |
| View workload and leaderboard | ✅ | ✅ | ✅ |

**Role rules**
- Anyone can sign in with Google. New accounts are always created with role **User**, except the email matching `ADMIN_EMAIL` which becomes **Admin** on first login.
- Admins promote users afterward through the admin panel.
- Deactivated users cannot log in (checked at login and on every request).
- Manager visibility is limited to tasks they created (assumption, easy to change later). Admin sees everything.

---

## 4. Features

### Required
1. Google login / signup
2. Create tasks (title, description, priority, due date)
3. Assign tasks to a user
4. Gmail email on task created (to assignee) and on task completed (to creator)

### Extras (in priority order)

**Tier 1: Core**
1. **Priority to-do list**: user's assigned tasks sorted by priority (High, then Medium, then Low), then due date; overdue highlighted
2. **Shared status and activity timeline**: pending, in_progress, completed, visible to creator and assignee, with a timeline of assignments, edits, status changes and completion
3. **Estimated hours + workload view**: each task has estimated hours; the team page and assignee dropdown show each user's open tasks and open hours
4. **Capacity indicator**: badge per user (Available / Busy / Overloaded) from open hours vs `weekly_capacity_hours` (default 40)
5. **Search, filters and sorting**: search by title; filter by status, priority, assignee; sort by due date, priority, created date

**Tier 2: Differentiators**
6. **Open Pool**: separate page and navbar button; tasks with no assignee that users can claim
7. **Points and leaderboard**: points awarded when a claimed pool task is completed

**Tier 3: Nice to have**
8. **Task queries**: comment thread per task so a user can ask the assigner a question and get an answer
9. **Reassignment**: Reassign button for admin/manager (logged in the timeline)
10. **Near-live updates**: the task list and comments refresh by polling every 15 to 30 seconds (no WebSockets)
11. **Dark / light mode**

**Tier 4: Only if time remains**
12. Due-date reminder emails (needs a scheduler). Overdue highlighting is already in Tier 1.

### Capacity rules
- Open hours = sum of `estimated_hours` of the user's non-completed tasks.
- Available: under 60% of weekly capacity. Busy: 60 to 100%. Overloaded: over 100%.
- Shown as a warning when assigning, not a hard block.

### Open Pool rules
- Pool tasks live on their own page and never appear in normal lists until claimed.
- Only Admin/Manager create pool tasks. Only Users claim.
- Claim is atomic to avoid two people taking the same task:
  `UPDATE tasks SET assigned_to = :me WHERE id = :id AND is_pool AND assigned_to IS NULL` and check that one row changed.
- Max **3 active** claimed pool tasks per user.
- A user can **release** a claimed task back to the pool (no points).
- Points are awarded on **completion**, not on claim. Priority decides points: Low 5, Medium 10, High 20.
- Claimed tasks move to the user's to-do list with a "from pool" badge.

### Emails (only these two, to keep scope small)
- Task created: to the assignee
- Task completed: to the creator
- No extra pool emails. Query/comment emails are optional and only if time allows.

---

## 5. Example Workflow

1. Admin logs in via `ADMIN_EMAIL`; Rahul and Priya log in and start as Users; Admin promotes Rahul to Manager in the admin panel.
2. Rahul opens New Task, enters "Fix login bug", High, due Friday. The assignee dropdown shows Priya with her current pending count. He assigns her.
3. Flask inserts the task and emails Priya.
4. Priya sees it at the top of her to-do list. She sets it to in_progress. Status history records the change.
5. Priya has a question and posts a comment. Rahul sees it and replies.
6. Priya marks it complete. Flask sets `completed_at` and emails Rahul.
7. Rahul posts a pool task "Update README" (Medium). Priya claims it. When she completes it she earns 10 points, and the leaderboard updates.

---

## 6. Data Model (Supabase / Postgres)

**users**: id, google_id, email, name, avatar_url, role (admin|manager|user), is_active, weekly_capacity_hours (default 40), created_at

**tasks**: id, title, description, status (pending|in_progress|completed), priority (1=low, 2=medium, 3=high), due_date, estimated_hours, created_by, assigned_to (nullable), is_pool, claimed_at, created_at, completed_at

**task_activity**: id, task_id, actor_id, event_type (created|assigned|reassigned|edited|status_changed|claimed|released|completed|commented), from_value, to_value, created_at

**task_comments**: id, task_id, author_id, body, created_at

**points_ledger**: id, user_id, task_id, points, reason, created_at (user total = SUM of points)

Notes
- Priority is stored as a number so sorting works correctly.
- Users are deactivated, not hard-deleted, so task references stay valid. Admin "delete" can mean deactivate.
- Add indexes on `tasks(assigned_to, status)` and `tasks(is_pool, assigned_to)`.
- Capacity and workload are calculated from queries, never stored.

---

## 7. API Endpoints (Flask)

**Auth**
- `GET /auth/google` start OAuth
- `GET /auth/callback` finish OAuth, upsert user, set cookie
- `GET /auth/me` current user
- `POST /auth/logout`

**Users (admin)**
- `GET /users` list (for dropdowns and team page; includes open task count, open hours, capacity status)
- `PATCH /users/:id` change role / active (admin)
- `DELETE /users/:id` deactivate (admin)

**Tasks**
- `POST /tasks` create and assign (admin, manager)
- `GET /tasks` role-scoped list (admin all, manager own created). Query params: `q`, `status`, `priority`, `assigned_to`, `sort`, `order`
- `GET /tasks/mine` to-do list sorted by priority (all)
- `PATCH /tasks/:id` edit / reassign (admin, manager); changing `assigned_to` logs a `reassigned` event
- `PATCH /tasks/:id/status` change status (assignee)
- `DELETE /tasks/:id` (admin, manager)
- `GET /tasks/:id/activity` timeline

**Comments**
- `GET /tasks/:id/comments`
- `POST /tasks/:id/comments`

**Open Pool**
- `POST /pool` create pool task (admin, manager)
- `GET /pool` list unclaimed pool tasks
- `POST /pool/:id/claim` (user)
- `POST /pool/:id/release` (user)

**Points**
- `GET /points/leaderboard`
- `GET /points/me`

All role checks use one decorator: `@require_role("admin", "manager")`.

---

## 8. Frontend Pages (Next.js)

- `/login` Google sign-in button
- `/dashboard` summary by role
- `/tasks/mine` priority to-do list with status controls
- `/tasks` manager/admin task list with search, filters and sorting, plus create/edit form
- `/tasks/[id]` detail, activity timeline, comment thread, reassign button
- `/team` workload view (open tasks, open hours, capacity badge)
- `/pool` Open Pool page (button in navbar)
- `/leaderboard` points ranking
- `/admin/users` roles, activate/deactivate
- Theme toggle in the navbar (dark/light)

---

## 9. Build Phases

**Phase 0: Setup**
- [ ] Git repo, folder structure (`/backend`, `/frontend`, `/migrations`), `.env.example`
- [ ] Supabase project

**Phase 1: Database**
- [ ] Migration SQL files for all tables
- [ ] Seed or test data

**Phase 2: Flask skeleton and Google OAuth**
- [ ] App structure, config, error handling
- [ ] Google Cloud OAuth credentials
- [ ] `/auth/*` routes, user upsert, JWT cookie
- [ ] `require_role` decorator, `ADMIN_EMAIL` bootstrap

**Phase 3: Next.js login flow**
- [ ] Project setup, login page, auth context
- [ ] Protected routes and role-aware navbar

**Phase 4: Task core**
- [ ] Create, list, edit, assign tasks (with estimated hours)
- [ ] Status change with activity timeline
- [ ] To-do list sorted by priority, overdue highlight

**Phase 5: Gmail notifications (mandatory)**
- [ ] Gmail API setup and refresh token
- [ ] Email on create and on complete

**Phase 6: Roles, workload and search**
- [ ] Role changes, activate/deactivate
- [ ] Workload view and capacity badge
- [ ] Search, filters, sorting

**Phase 7: Open Pool and points**
- [ ] Pool CRUD, atomic claim, release, claim limit
- [ ] Points ledger and leaderboard

**Phase 8: Tier 3 extras and polish**
- [ ] Comment threads and reassign button
- [ ] Polling refresh
- [ ] Dark/light mode
- [ ] UI cleanup

**Phase 9: Deploy and submit**
- [ ] Deploy all three parts, set production env vars and OAuth redirect URIs
- [ ] Full test on the live URL with 3 different Google accounts
- [ ] README with Architecture
- [ ] Loom video, form submission

If time gets tight, cut in this order: reminder emails, dark mode, polling, comments, leaderboard. Never cut the mandatory checklist.

---

## 10. Be Ready to Explain (interview)

- OAuth 2.0 authorization code flow, step by step
- Why JWT in an httpOnly cookie, and CSRF/CORS basics
- Why permission checks live in the backend
- The `require_role` decorator
- The atomic claim query and the race condition it prevents
- Why a points ledger beats a stored counter
- How workload and capacity are calculated (and why they are not stored)
- Why polling instead of WebSockets, and its trade-off
- Gmail API vs SMTP, and how the refresh token works
- Why deactivate instead of delete
- Why priority is stored as a number

---

## 11. Out of Scope

- Real-time chat or WebSockets
- Notification center
- File attachments
- Completion review / approval step
- Users creating their own tasks
- Managers claiming pool tasks
- Extra pool emails
- Mobile app
