/**
 * Typed fetch wrapper for the Flask API.
 *
 * Always sends cookies (credentials: "include") so the httpOnly JWT cookie
 * is forwarded on every request automatically — no manual token handling.
 *
 * Usage
 * -----
 * import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api"
 *
 * const user = await apiGet<User>("/auth/me")
 * const task = await apiPost<Task>("/tasks", { title: "Fix bug", ... })
 */

const BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include", // Send the httpOnly JWT cookie on every request
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }

  // 204 No Content responses have no body
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

export const apiGet = <T>(path: string): Promise<T> => apiFetch<T>(path);

export const apiPost = <T>(path: string, body?: unknown): Promise<T> =>
  apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) });

export const apiPatch = <T>(path: string, body?: unknown): Promise<T> =>
  apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) });

export const apiDelete = <T>(path: string): Promise<T> =>
  apiFetch<T>(path, { method: "DELETE" });

