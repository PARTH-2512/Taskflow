"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { apiGet, apiPatch } from "@/lib/api";
import { Task, TaskStatus } from "@/lib/types";

/** How often to silently refresh the task list (ms). */
const POLL_INTERVAL_MS = 25_000; // 25 seconds

export default function MyTasksPage() {
  const { user, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed">("active");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadTasks(silent = false) {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const data = await apiGet<Task[]>("/tasks/mine");
      setTasks(data);
    } catch (err: any) {
      if (!silent) setError(err.message || "Failed to load tasks");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  // Initial load
  useEffect(() => {
    if (user) {
      loadTasks();
    }
  }, [user]);

  // Polling — refresh silently every POLL_INTERVAL_MS
  useEffect(() => {
    if (!user) return;

    pollRef.current = setInterval(() => {
      loadTasks(true /* silent */);
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [user]);

  async function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    try {
      setUpdatingId(taskId);
      const updated = await apiPatch<Task>(`/tasks/${taskId}/status`, { status: newStatus });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...updated } : t))
      );
    } catch (err: any) {
      alert(`Could not update status: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter === "active") return t.status !== "completed";
    if (statusFilter === "completed") return t.status === "completed";
    return true;
  });

  const activeCount = tasks.filter((t) => t.status !== "completed").length;
  const overdueCount = tasks.filter((t) => t.is_overdue).length;

  const priorityLabel = { 3: "High", 2: "Medium", 1: "Low" };
  const priorityBadge = {
    3: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
    2: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    1: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600",
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              My Priority Tasks
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Sorted by Priority (High &rarr; Low), due date, and overdue urgency.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {overdueCount > 0 && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                ⚠ {overdueCount} Overdue
              </span>
            )}
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
              {activeCount} Active Tasks
            </span>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 mb-6">
          <button
            onClick={() => setStatusFilter("active")}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              statusFilter === "active"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setStatusFilter("all")}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              statusFilter === "all"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            All Tasks ({tasks.length})
          </button>
          <button
            onClick={() => setStatusFilter("completed")}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              statusFilter === "completed"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            Completed ({tasks.length - activeCount})
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Loading tasks...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-400 mb-6">
            {error}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 text-center py-16 px-4">
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">No tasks in this list</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {statusFilter === "active"
                ? "You're all caught up! Explore the Open Pool to claim tasks."
                : "No tasks matched the selected filter."}
            </p>
            <div className="mt-5">
              <Link
                href="/pool"
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
              >
                Browse Open Pool
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTasks.map((task) => {
              const isOverdue = task.is_overdue;
              const isUpdating = updatingId === task.id;

              return (
                <div
                  key={task.id}
                  className={`bg-white dark:bg-gray-800 rounded-xl border p-5 transition shadow-sm hover:shadow-md ${
                    isOverdue
                      ? "border-rose-300 dark:border-rose-800 ring-1 ring-rose-300 dark:ring-rose-800 bg-rose-50/20 dark:bg-rose-900/5"
                      : task.status === "completed"
                      ? "border-gray-200 dark:border-gray-700 opacity-75"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1">
                      {/* Priority + Overdue + Pool Badge */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            priorityBadge[task.priority]
                          }`}
                        >
                          {priorityLabel[task.priority]} Priority
                        </span>

                        {isOverdue && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white animate-pulse">
                            OVERDUE
                          </span>
                        )}

                        {task.is_pool && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                            From Pool
                          </span>
                        )}

                        {task.estimated_hours && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            ⏱ {task.estimated_hours} hrs
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <Link
                        href={`/tasks/${task.id}`}
                        className={`text-lg font-semibold hover:text-indigo-600 dark:hover:text-indigo-400 transition block ${
                          task.status === "completed"
                            ? "line-through text-gray-500 dark:text-gray-500"
                            : "text-gray-900 dark:text-gray-100"
                        }`}
                      >
                        {task.title}
                      </Link>

                      {/* Description */}
                      {task.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      {/* Metadata footer */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        {task.due_date && (
                          <span className={isOverdue ? "text-rose-600 dark:text-rose-400 font-semibold" : ""}>
                            📅 Due: {task.due_date}
                          </span>
                        )}
                        <span>Assigned by: {task.creator_name || task.creator_email}</span>
                        <Link
                          href={`/tasks/${task.id}`}
                          className="text-indigo-600 dark:text-indigo-400 hover:underline ml-auto font-medium"
                        >
                          View Details &amp; Activity &rarr;
                        </Link>
                      </div>
                    </div>

                    {/* Status Changer */}
                    <div className="sm:self-center flex sm:flex-col items-center gap-2 min-w-[140px]">
                      <span className="text-xs text-gray-400 dark:text-gray-500 sm:block hidden text-center">
                        Update Status
                      </span>
                      <select
                        value={task.status}
                        disabled={isUpdating}
                        onChange={(e) =>
                          handleStatusChange(task.id, e.target.value as TaskStatus)
                        }
                        className={`w-full text-xs font-semibold rounded-lg px-3 py-2 border shadow-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${
                          task.status === "completed"
                            ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
                            : task.status === "in_progress"
                            ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                            : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                        }`}
                      >
                        <option value="pending">⏳ Pending</option>
                        <option value="in_progress">🔄 In Progress</option>
                        <option value="completed">✓ Completed</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
