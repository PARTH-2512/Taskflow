"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { apiGet, apiPatch } from "@/lib/api";
import { Task, TaskActivity, TaskStatus, User } from "@/lib/types";

export default function TaskDetailPage() {
  const { id } = useParams() as { id: string };
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [task, setTask] = useState<Task | null>(null);
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status changing state
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Reassignment state
  const [isReassigning, setIsReassigning] = useState(false);
  const [newAssignee, setNewAssignee] = useState("");
  const [reassigningLoading, setReassigningLoading] = useState(false);

  async function loadTaskData() {
    try {
      setLoading(true);
      setError(null);

      const [taskData, activityData] = await Promise.all([
        apiGet<Task>(`/tasks/${id}`),
        apiGet<TaskActivity[]>(`/tasks/${id}/activity`),
      ]);

      setTask(taskData);
      setActivities(activityData);
      setNewAssignee(taskData.assigned_to || "");

      // If user can reassign (admin or manager creator), load active users
      if (user && (user.role === "admin" || user.id === taskData.created_by)) {
        apiGet<User[]>("/users")
          .then(setUsers)
          .catch(() => {});
      }
    } catch (err: any) {
      setError(err.message || "Failed to load task details");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user && id) {
      loadTaskData();
    }
  }, [user, id]);

  async function handleStatusChange(newStatus: TaskStatus) {
    if (!task) return;
    try {
      setStatusUpdating(true);
      const updated = await apiPatch<Task>(`/tasks/${task.id}/status`, { status: newStatus });
      setTask(updated);
      // Reload activity timeline to reflect the status change
      const refreshedActivities = await apiGet<TaskActivity[]>(`/tasks/${id}/activity`);
      setActivities(refreshedActivities);
    } catch (err: any) {
      alert(`Could not update status: ${err.message}`);
    } finally {
      setStatusUpdating(false);
    }
  }

  async function handleReassign() {
    if (!task || !newAssignee) return;
    try {
      setReassigningLoading(true);
      const updated = await apiPatch<Task>(`/tasks/${task.id}`, { assigned_to: newAssignee });
      setTask(updated);
      setIsReassigning(false);
      // Reload activity timeline to show the reassign event
      const refreshedActivities = await apiGet<TaskActivity[]>(`/tasks/${id}/activity`);
      setActivities(refreshedActivities);
    } catch (err: any) {
      alert(`Reassign failed: ${err.message}`);
    } finally {
      setReassigningLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const priorityLabel = { 3: "High", 2: "Medium", 1: "Low" };
  const priorityBadge = {
    3: "bg-red-50 text-red-700 border-red-200",
    2: "bg-amber-50 text-amber-700 border-amber-200",
    1: "bg-gray-50 text-gray-700 border-gray-200",
  };

  const statusBadge = {
    completed: "bg-green-50 text-green-700 border-green-200",
    in_progress: "bg-blue-50 text-blue-700 border-blue-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
  };

  const canReassign =
    user && task && (user.role === "admin" || user.id === task.created_by);

  const canChangeStatus =
    user && task && (user.role === "admin" || user.id === task.assigned_to);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="mb-4 text-xs text-gray-500 flex items-center gap-2">
          <Link href="/tasks/mine" className="hover:text-indigo-600">
            My Tasks
          </Link>
          <span>/</span>
          {user && (user.role === "admin" || user.role === "manager") && (
            <>
              <Link href="/tasks" className="hover:text-indigo-600">
                All Tasks
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-gray-900 font-medium truncate max-w-xs">
            {task?.title || "Task Details"}
          </span>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="text-sm text-gray-500 mt-2">Loading task details...</p>
          </div>
        ) : error || !task ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-6 text-center">
            <h3 className="font-semibold">{error || "Task not found"}</h3>
            <div className="mt-4">
              <button
                onClick={() => router.back()}
                className="text-sm text-red-700 underline font-medium"
              >
                &larr; Go Back
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Task Card Header */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                      priorityBadge[task.priority]
                    }`}
                  >
                    {priorityLabel[task.priority]} Priority
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold border capitalize ${
                      statusBadge[task.status]
                    }`}
                  >
                    {task.status.replace("_", " ")}
                  </span>
                  {task.is_overdue && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-600 text-white">
                      OVERDUE
                    </span>
                  )}
                  {task.is_pool && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                      Pool Task
                    </span>
                  )}
                </div>

                {/* Status Switcher for Assignee */}
                {canChangeStatus && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Status:</span>
                    <select
                      value={task.status}
                      disabled={statusUpdating}
                      onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                      className="text-xs font-semibold rounded-lg px-3 py-1.5 border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="pending">⏳ Pending</option>
                      <option value="in_progress">🔄 In Progress</option>
                      <option value="completed">✓ Completed</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Title & Description */}
              <div className="mt-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  {task.title}
                </h1>
                {task.description ? (
                  <p className="mt-4 text-gray-700 whitespace-pre-wrap leading-relaxed text-sm">
                    {task.description}
                  </p>
                ) : (
                  <p className="mt-4 text-gray-400 italic text-sm">
                    No description provided for this task.
                  </p>
                )}
              </div>

              {/* Metadata Grid */}
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-gray-100 text-xs">
                <div>
                  <span className="text-gray-400 block uppercase font-semibold">Assignee</span>
                  <div className="mt-1 flex items-center gap-2">
                    {task.assignee_avatar ? (
                      <Image
                        src={task.assignee_avatar}
                        alt=""
                        width={20}
                        height={20}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px]">
                        {(task.assignee_name || "U")[0]}
                      </div>
                    )}
                    <span className="font-medium text-gray-900">
                      {task.assignee_name || "Unassigned"}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-gray-400 block uppercase font-semibold">Creator</span>
                  <span className="mt-1 font-medium text-gray-900 block">
                    {task.creator_name || task.creator_email}
                  </span>
                </div>

                <div>
                  <span className="text-gray-400 block uppercase font-semibold">Due Date</span>
                  <span
                    className={`mt-1 font-medium block ${
                      task.is_overdue ? "text-rose-600 font-bold" : "text-gray-900"
                    }`}
                  >
                    {task.due_date || "No deadline"}
                  </span>
                </div>

                <div>
                  <span className="text-gray-400 block uppercase font-semibold">Estimated Hours</span>
                  <span className="mt-1 font-medium text-gray-900 block">
                    {task.estimated_hours ? `${task.estimated_hours} hrs` : "Not estimated"}
                  </span>
                </div>
              </div>

              {/* Reassign Panel for Admin / Manager */}
              {canReassign && (
                <div className="mt-6 pt-6 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-gray-500">
                    Need to assign this task to someone else?
                  </div>
                  {!isReassigning ? (
                    <button
                      onClick={() => setIsReassigning(true)}
                      className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition cursor-pointer"
                    >
                      Reassign Task
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <select
                        value={newAssignee}
                        onChange={(e) => setNewAssignee(e.target.value)}
                        className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Select new assignee</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.role}) — {u.capacity_status?.toUpperCase() || "AVAILABLE"}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleReassign}
                        disabled={reassigningLoading || !newAssignee}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 cursor-pointer"
                      >
                        {reassigningLoading ? "Saving..." : "Confirm"}
                      </button>
                      <button
                        onClick={() => setIsReassigning(false)}
                        className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-800 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Activity Timeline */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span>🕒 Activity Timeline</span>
                <span className="text-xs font-normal text-gray-400">
                  ({activities.length} events logged)
                </span>
              </h2>

              {activities.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No activity recorded yet.</p>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                  {activities.map((act) => {
                    const eventIcon = {
                      created: "✨",
                      assigned: "👤",
                      reassigned: "🔀",
                      edited: "✏",
                      status_changed: "🔄",
                      claimed: "⚡",
                      released: "↩",
                      completed: "✅",
                      commented: "💬",
                    }[act.event_type] || "•";

                    return (
                      <div key={act.id} className="relative flex items-start gap-4">
                        {/* Timeline Marker */}
                        <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-white border-2 border-indigo-500 flex items-center justify-center text-[10px]">
                          {eventIcon}
                        </div>

                        <div className="flex-1 bg-gray-50 rounded-xl p-3.5 border border-gray-100 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-gray-900">
                              {act.actor_name || act.actor_email}
                            </span>
                            <span className="text-gray-400 text-[11px]">
                              {new Date(act.created_at).toLocaleString()}
                            </span>
                          </div>

                          <div className="mt-1 text-gray-700">
                            {act.event_type === "created" && (
                              <span>Created task: &quot;{act.to_value}&quot;</span>
                            )}
                            {act.event_type === "assigned" && (
                              <span>Assigned task to <strong>{act.to_value}</strong></span>
                            )}
                            {act.event_type === "reassigned" && (
                              <span>
                                Reassigned task from <em>{act.from_value}</em> to <strong>{act.to_value}</strong>
                              </span>
                            )}
                            {act.event_type === "status_changed" && (
                              <span>
                                Status changed from <code className="bg-white px-1 py-0.5 rounded border">{act.from_value}</code> to <code className="bg-white px-1 py-0.5 rounded border">{act.to_value}</code>
                              </span>
                            )}
                            {act.event_type === "completed" && (
                              <span className="text-green-700 font-semibold">
                                ✓ Task completed!
                              </span>
                            )}
                            {act.event_type === "edited" && (
                              <span>{act.to_value || "Updated task details"}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

