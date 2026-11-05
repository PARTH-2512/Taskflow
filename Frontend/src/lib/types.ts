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
  created_at: string;
}

