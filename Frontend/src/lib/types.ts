/** Shared TypeScript types — keep in sync with the Flask response shapes. */

export type Role = "admin" | "manager" | "user";

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: Role;
  is_active: boolean;
  weekly_capacity_hours: number;
  created_at?: string;
  open_tasks?: number;
  open_hours?: number;
  capacity_status?: "available" | "busy" | "overloaded";
}

export type TaskStatus = "pending" | "in_progress" | "completed";
export type TaskPriority = 1 | 2 | 3; // 1 = Low, 2 = Medium, 3 = High

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  is_overdue?: boolean;
  estimated_hours: number | null;
  created_by: string;
  creator_name?: string;
  creator_email?: string;
  assigned_to: string | null;
  assignee_name?: string | null;
  assignee_email?: string | null;
  assignee_avatar?: string | null;
  is_pool: boolean;
  created_at: string;
  completed_at: string | null;
}

export interface TaskActivity {
  id: string;
  task_id: string;
  actor_id: string;
  actor_name: string;
  actor_email: string;
  actor_avatar: string | null;
  event_type:
    | "created"
    | "assigned"
    | "reassigned"
    | "edited"
    | "status_changed"
    | "claimed"
    | "released"
    | "completed"
    | "commented";
  from_value: string | null;
  to_value: string | null;
  created_at: string;
}

export interface PoolTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  potential_points: number;
  estimated_hours: number | null;
  created_by: string;
  creator_name?: string;
  creator_email?: string;
  assigned_to: string | null;
  is_pool: boolean;
  claimed_at: string | null;
  created_at: string;
}

export interface PoolData {
  unclaimed: PoolTask[];
  my_claimed: PoolTask[];
  active_claimed_count: number;
  max_claim_limit: number;
}

export interface LeaderboardEntry {
  user_id: string;
  name: string;
  avatar_url: string | null;
  total_points: number;
  rank: number;
}

export interface PointsHistoryItem {
  id: string;
  task_id: string;
  task_title: string;
  task_priority: TaskPriority;
  points: number;
  reason: string;
  created_at: string;
}

export interface MyPointsData {
  total_points: number;
  history: PointsHistoryItem[];
}
