"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { Task, User, TaskPriority, TaskStatus } from "@/lib/types";

/** How often to silently refresh the task list (ms). */
const POLL_INTERVAL_MS = 30_000; // 30 seconds

export default function AllTasksPage() {
  const { user, loading: authLoading } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPriority, setFormPriority] = useState<TaskPriority>(2);
  const [formDueDate, setFormDueDate] = useState("");
  const [formEstHours, setFormEstHours] = useState("");
  const [formAssignee, setFormAssignee] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadData(silent = false) {
    try {
      if (!silent) setLoading(true);
      setError(null);

      // Build query string
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      if (assigneeFilter) params.set("assigned_to", assigneeFilter);
      params.set("sort", sortBy);
      params.set("order", sortOrder);

      const [tasksData, usersData] = await Promise.all([
        apiGet<Task[]>(`/tasks?${params.toString()}`),
        apiGet<User[]>("/users").catch(() => []),
      ]);

      setTasks(tasksData);
      setUsers(usersData);
    } catch (err: any) {
      if (!silent) setError(err.message || "Failed to load tasks");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  // Initial load & filter-change reload
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, search, statusFilter, priorityFilter, assigneeFilter, sortBy, sortOrder]);

  // Polling — reset whenever filters change
  useEffect(() => {
    if (!user) return;

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      loadData(true /* silent */);
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [user, search, statusFilter, priorityFilter, assigneeFilter, sortBy, sortOrder]);

  function openCreateModal() {
    setEditingTask(null);
    setFormTitle("");
    setFormDesc("");
    setFormPriority(2);
    setFormDueDate("");
    setFormEstHours("");
    setFormAssignee(users[0]?.id || "");
    setFormError(null);
    setIsModalOpen(true);
  }

  function openEditModal(task: Task) {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDesc(task.description || "");
    setFormPriority(task.priority);
    setFormDueDate(task.due_date || "");
    setFormEstHours(task.estimated_hours ? String(task.estimated_hours) : "");
    setFormAssignee(task.assigned_to || "");
    setFormError(null);
    setIsModalOpen(true);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError("Title is required");
      return;
    }
    if (!formAssignee) {
      setFormError("Please select an assignee");
      return;
    }

    try {
      setFormSubmitting(true);
      setFormError(null);

      const payload = {
        title: formTitle.trim(),
        description: formDesc.trim() || null,
        priority: Number(formPriority),
        due_date: formDueDate || null,
        estimated_hours: formEstHours ? parseFloat(formEstHours) : null,
        assigned_to: formAssignee,
      };

      if (editingTask) {
        await apiPatch(`/tasks/${editingTask.id}`, payload);
      } else {
        await apiPost("/tasks", payload);
      }

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || "Operation failed");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleDelete(taskId: string) {
    if (!confirm("Are you sure you want to delete this task? This action cannot be undone.")) return;
    try {
      await apiDelete(`/tasks/${taskId}`);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err: any) {
      alert(`Could not delete task: ${err.message}`);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const selectedAssigneeUser = users.find((u) => u.id === formAssignee);
  const isAssigneeOverloaded = selectedAssigneeUser?.capacity_status === "overloaded";

  const priorityLabel = { 3: "High", 2: "Medium", 1: "Low" };
  const priorityBadge = {
    3: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
    2: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    1: "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600",
  };

  const statusBadge = {
    completed: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
    in_progress: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    pending: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              {user.role === "admin" ? "All Team Tasks" : "Tasks Created by Me"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {user.role === "admin"
                ? "Manage, assign, and track all tasks across the company."
                : "Manage and assign tasks you have created for your team."}
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white font-medium text-sm rounded-xl shadow-sm hover:bg-indigo-700 transition cursor-pointer"
          >
            <span>+ Create Task</span>
          </button>
        </div>

        {/* Filters Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Search */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Search</label>
              <input
                type="text"
                placeholder="Search title or details..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Priority</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">All Priorities</option>
                <option value="3">High</option>
                <option value="2">Medium</option>
                <option value="1">Low</option>
              </select>
            </div>

            {/* Assignee */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Assignee</label>
              <select
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">All Assignees</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
            <span>Showing {tasks.length} tasks</span>
            <div className="flex items-center gap-2">
              <span>Sort by:</span>
              <button
                onClick={() => {
                  if (sortBy === "created_at") setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                  else { setSortBy("created_at"); setSortOrder("desc"); }
                }}
                className={`px-2 py-1 rounded cursor-pointer ${sortBy === "created_at" ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-semibold" : ""}`}
              >
                Created {sortBy === "created_at" && (sortOrder === "asc" ? "↑" : "↓")}
              </button>
              <button
                onClick={() => {
                  if (sortBy === "priority") setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                  else { setSortBy("priority"); setSortOrder("desc"); }
                }}
                className={`px-2 py-1 rounded cursor-pointer ${sortBy === "priority" ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-semibold" : ""}`}
              >
                Priority {sortBy === "priority" && (sortOrder === "asc" ? "↑" : "↓")}
              </button>
              <button
                onClick={() => {
                  if (sortBy === "due_date") setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                  else { setSortBy("due_date"); setSortOrder("asc"); }
                }}
                className={`px-2 py-1 rounded cursor-pointer ${sortBy === "due_date" ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-semibold" : ""}`}
              >
                Due Date {sortBy === "due_date" && (sortOrder === "asc" ? "↑" : "↓")}
              </button>
            </div>
          </div>
        </div>

        {/* Task List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Loading tasks...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        ) : tasks.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 text-center py-16 px-4">
            <div className="text-4xl mb-3">📋</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">No tasks found</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Create your first task or adjust your search filters above.
            </p>
            <button
              onClick={openCreateModal}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer"
            >
              + Create Task
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/75 dark:hover:bg-gray-700/40 transition"
                >
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${priorityBadge[task.priority]}`}>
                        {priorityLabel[task.priority]}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${statusBadge[task.status]}`}>
                        {task.status.replace("_", " ")}
                      </span>
                      {task.is_overdue && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white">
                          OVERDUE
                        </span>
                      )}
                    </div>

                    <Link
                      href={`/tasks/${task.id}`}
                      className="text-base font-semibold text-gray-900 dark:text-gray-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition block"
                    >
                      {task.title}
                    </Link>

                    {task.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                        {task.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mt-2">
                      <span>
                        👤 Assigned: <strong className="text-gray-700 dark:text-gray-300">{task.assignee_name || "Unassigned"}</strong>
                      </span>
                      {task.due_date && (
                        <span className={task.is_overdue ? "text-rose-600 dark:text-rose-400 font-semibold" : ""}>
                          📅 Due: {task.due_date}
                        </span>
                      )}
                      {task.estimated_hours && (
                        <span>⏱ {task.estimated_hours} hrs</span>
                      )}
                      <span>Creator: {task.creator_name || task.creator_email}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    <Link
                      href={`/tasks/${task.id}`}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition"
                    >
                      View &amp; History
                    </Link>
                    <button
                      onClick={() => openEditModal(task)}
                      className="px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal: Create / Edit Task */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {editingTask ? "Edit / Reassign Task" : "Create New Task"}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs rounded-lg p-3">
                  {formError}
                </div>
              )}

              <form onSubmit={handleFormSubmit} className="mt-4 space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Task Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Implement Google OAuth login"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder-gray-400 dark:placeholder-gray-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Details, acceptance criteria, or requirements..."
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder-gray-400 dark:placeholder-gray-500"
                  />
                </div>

                {/* Priority & Estimated Hours */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Priority
                    </label>
                    <select
                      value={formPriority}
                      onChange={(e) => setFormPriority(Number(e.target.value) as TaskPriority)}
                      className="w-full text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value={3}>🔴 High</option>
                      <option value={2}>🟡 Medium</option>
                      <option value={1}>⚪ Low</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Estimated Hours
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      placeholder="e.g. 4.5"
                      value={formEstHours}
                      onChange={(e) => setFormEstHours(e.target.value)}
                      className="w-full text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder-gray-400 dark:placeholder-gray-500"
                    />
                  </div>
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Assignee with Capacity Badge */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Assignee *
                  </label>
                  <select
                    required
                    value={formAssignee}
                    onChange={(e) => setFormAssignee(e.target.value)}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">Select a team member</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} — {u.capacity_status?.toUpperCase() || "AVAILABLE"} ({u.open_tasks || 0} open tasks, {u.open_hours || 0} hrs)
                      </option>
                    ))}
                  </select>

                  {/* Overload Capacity Warning */}
                  {isAssigneeOverloaded && (
                    <div className="mt-2 text-xs bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-400 rounded-lg p-2.5 flex items-center gap-2">
                      <span>⚠</span>
                      <span>
                        <strong>Capacity Warning:</strong> {selectedAssigneeUser?.name} currently has {selectedAssigneeUser?.open_hours} hrs assigned (over 100% capacity).
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                  >
                    {formSubmitting
                      ? "Saving..."
                      : editingTask
                      ? "Update Task"
                      : "Create Task"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
