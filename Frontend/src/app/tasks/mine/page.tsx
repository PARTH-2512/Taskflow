"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { apiGet, apiPatch } from "@/lib/api";
import { Task, TaskStatus } from "@/lib/types";

export default function MyTasksPage() {
  const { user, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed">("active");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function loadTasks() {
    try {
      setLoading(true);
      setError(null);
      const data = await apiGet<Task[]>("/tasks/mine");
      setTasks(data);
    } catch (err: any) {
      setError(err.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) {
      loadTasks();
    }
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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
    3: "bg-red-100 text-red-700 border-red-200",
    2: "bg-amber-100 text-amber-700 border-amber-200",
    1: "bg-gray-100 text-gray-700 border-gray-200",
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              My Priority Tasks
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Sorted by Priority (High &rarr; Low), due date, and overdue urgency.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {overdueCount > 0 && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                ⚠ {overdueCount} Overdue
              </span>
            )}
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
              {activeCount} Active Tasks
            </span>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 border-b border-gray-200 mb-6">
          <button
            onClick={() => setStatusFilter("active")}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              statusFilter === "active"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setStatusFilter("all")}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              statusFilter === "all"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            All Tasks ({tasks.length})
          </button>
          <button
            onClick={() => setStatusFilter("completed")}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              statusFilter === "completed"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Completed ({tasks.length - activeCount})
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="text-sm text-gray-500 mt-2">Loading tasks...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-6">
            {error}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 text-center py-16 px-4">
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="text-lg font-semibold text-gray-900">No tasks in this list</h3>
            <p className="text-sm text-gray-500 mt-1">
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
                  className={`bg-white rounded-xl border p-5 transition shadow-sm hover:shadow-md ${
                    isOverdue
                      ? "border-rose-300 ring-1 ring-rose-300 bg-rose-50/20"
                      : task.status === "completed"
                      ? "border-gray-200 opacity-75 bg-gray-50/50"
                      : "border-gray-200"
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
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            From Pool
                          </span>
                        )}

                        {task.estimated_hours && (
                          <span className="text-xs text-gray-500">
                            ⏱ {task.estimated_hours} hrs
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <Link
                        href={`/tasks/${task.id}`}
                        className={`text-lg font-semibold hover:text-indigo-600 transition block ${
                          task.status === "completed"
                            ? "line-through text-gray-500"
                            : "text-gray-900"
                        }`}
                      >
                        {task.title}
                      </Link>

                      {/* Description */}
                      {task.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      {/* Metadata footer */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">
                        {task.due_date && (
                          <span className={isOverdue ? "text-rose-600 font-semibold" : ""}>
                            📅 Due: {task.due_date}
                          </span>
                        )}
                        <span>Assigned by: {task.creator_name || task.creator_email}</span>
                        <Link
                          href={`/tasks/${task.id}`}
                          className="text-indigo-600 hover:underline ml-auto font-medium"
                        >
                          View Details & Activity &rarr;
                        </Link>
                      </div>
                    </div>

                    {/* Status Changer */}
                    <div className="sm:self-center flex sm:flex-col items-center gap-2 min-w-[140px]">
                      <span className="text-xs text-gray-400 sm:block hidden text-center">
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
                            ? "bg-green-50 text-green-700 border-green-200"
                            : task.status === "in_progress"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
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

