"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { Task, TaskActivity, TaskComment, TaskStatus, User } from "@/lib/types";

/** How often to auto-refresh the task detail page (ms). */
const POLL_INTERVAL_MS = 20_000; // 20 seconds

export default function TaskDetailPage() {
  const { id } = useParams() as { id: string };
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [task, setTask] = useState<Task | null>(null);
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status changing state
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Reassignment state
  const [isReassigning, setIsReassigning] = useState(false);
  const [newAssignee, setNewAssignee] = useState("");
  const [reassigningLoading, setReassigningLoading] = useState(false);

  // Comment state
  const [commentBody, setCommentBody] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Polling ref
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadTaskData(silent = false) {
    try {
      if (!silent) setLoading(true);
      setError(null);

      const [taskData, activityData, commentsData] = await Promise.all([
        apiGet<Task>(`/tasks/${id}`),
        apiGet<TaskActivity[]>(`/tasks/${id}/activity`),
        apiGet<TaskComment[]>(`/tasks/${id}/comments`),
      ]);

      setTask(taskData);
      setActivities(activityData);
      setComments(commentsData);
      setNewAssignee(taskData.assigned_to || "");

      // If user can reassign (admin or manager creator), load active users
      if (user && (user.role === "admin" || user.id === taskData.created_by)) {
        apiGet<User[]>("/users")
          .then(setUsers)
          .catch(() => {});
      }
    } catch (err: any) {
      if (!silent) setError(err.message || "Failed to load task details");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  // Initial load
  useEffect(() => {
    if (user && id) {
      loadTaskData();
    }
  }, [user, id]);

  // Polling — refresh silently every POLL_INTERVAL_MS
  useEffect(() => {
    if (!user || !id) return;

    pollRef.current = setInterval(() => {
      loadTaskData(true /* silent */);
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
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

  async function handlePostComment(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = commentBody.trim();
    if (!trimmed || postingComment) return;
    try {
      setPostingComment(true);
      const newComment = await apiPost<TaskComment>(`/tasks/${id}/comments`, { body: trimmed });
      setComments((prev) => [...prev, newComment]);
      setCommentBody("");
      // Scroll to new comment
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
      // Refresh activity too (comment adds an event)
      const refreshedActivities = await apiGet<TaskActivity[]>(`/tasks/${id}/activity`);
      setActivities(refreshedActivities);
    } catch (err: any) {
      alert(`Could not post comment: ${err.message}`);
    } finally {
      setPostingComment(false);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const priorityLabel = { 3: "High", 2: "Medium", 1: "Low" };
  const priorityBadge = {
    3: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
    2: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    1: "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700",
  };

  const statusBadge = {
    completed: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
    in_progress: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    pending: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  };

  const canReassign =
    user && task && (user.role === "admin" || user.id === task.created_by);

  const canChangeStatus =
    user && task && (user.role === "admin" || user.id === task.assigned_to);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="mb-4 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <Link href="/tasks/mine" className="hover:text-indigo-600 dark:hover:text-indigo-400">
            My Tasks
          </Link>
          <span>/</span>
          {user && (user.role === "admin" || user.role === "manager") && (
            <>
              <Link href="/tasks" className="hover:text-indigo-600 dark:hover:text-indigo-400">
                All Tasks
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-gray-900 dark:text-gray-100 font-medium truncate max-w-xs">
            {task?.title || "Task Details"}
          </span>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Loading task details...</p>
          </div>
        ) : error || !task ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-2xl p-6 text-center">
            <h3 className="font-semibold">{error || "Task not found"}</h3>
            <div className="mt-4">
              <button
                onClick={() => router.back()}
                className="text-sm text-red-700 dark:text-red-400 underline font-medium"
              >
                &larr; Go Back
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Task Card Header */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-700">
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
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                      Pool Task
                    </span>
                  )}
                </div>

                {/* Status Switcher for Assignee */}
                {canChangeStatus && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Status:</span>
                    <select
                      value={task.status}
                      disabled={statusUpdating}
                      onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                      className="text-xs font-semibold rounded-lg px-3 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
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
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {task.title}
                </h1>
                {task.description ? (
                  <p className="mt-4 text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed text-sm">
                    {task.description}
                  </p>
                ) : (
                  <p className="mt-4 text-gray-400 dark:text-gray-500 italic text-sm">
                    No description provided for this task.
                  </p>
                )}
              </div>

              {/* Metadata Grid */}
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-gray-100 dark:border-gray-700 text-xs">
                <div>
                  <span className="text-gray-400 dark:text-gray-500 block uppercase font-semibold">Assignee</span>
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
                      <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-bold text-[10px]">
                        {(task.assignee_name || "U")[0]}
                      </div>
                    )}
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {task.assignee_name || "Unassigned"}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-gray-400 dark:text-gray-500 block uppercase font-semibold">Creator</span>
                  <span className="mt-1 font-medium text-gray-900 dark:text-gray-100 block">
                    {task.creator_name || task.creator_email}
                  </span>
                </div>

                <div>
                  <span className="text-gray-400 dark:text-gray-500 block uppercase font-semibold">Due Date</span>
                  <span
                    className={`mt-1 font-medium block ${
                      task.is_overdue ? "text-rose-600 font-bold" : "text-gray-900 dark:text-gray-100"
                    }`}
                  >
                    {task.due_date || "No deadline"}
                  </span>
                </div>

                <div>
                  <span className="text-gray-400 dark:text-gray-500 block uppercase font-semibold">Estimated Hours</span>
                  <span className="mt-1 font-medium text-gray-900 dark:text-gray-100 block">
                    {task.estimated_hours ? `${task.estimated_hours} hrs` : "Not estimated"}
                  </span>
                </div>
              </div>

              {/* Reassign Panel for Admin / Manager */}
              {canReassign && (
                <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Need to assign this task to someone else?
                  </div>
                  {!isReassigning ? (
                    <button
                      onClick={() => setIsReassigning(true)}
                      className="px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition cursor-pointer"
                    >
                      Reassign Task
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <select
                        value={newAssignee}
                        onChange={(e) => setNewAssignee(e.target.value)}
                        className="text-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                        className="px-2 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Comments Section */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-2">
                <span>💬 Comments</span>
                <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
                  ({comments.length})
                </span>
              </h2>

              {/* Comment list */}
              <div className="space-y-4 mb-6">
                {comments.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    No comments yet. Be the first to leave one!
                  </p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="flex items-start gap-3">
                      {/* Avatar */}
                      {comment.author_avatar ? (
                        <Image
                          src={comment.author_avatar}
                          alt={comment.author_name}
                          width={32}
                          height={32}
                          className="rounded-full flex-shrink-0 mt-0.5"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-bold text-sm flex-shrink-0 mt-0.5">
                          {(comment.author_name || "U")[0]}
                        </div>
                      )}

                      {/* Bubble */}
                      <div className="flex-1 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3.5 border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                            {comment.author_name || comment.author_email}
                            {user && comment.author_id === user.id && (
                              <span className="ml-1.5 text-[10px] font-normal text-indigo-500 dark:text-indigo-400">(you)</span>
                            )}
                          </span>
                          <span className="text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                            {new Date(comment.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {comment.body}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={commentsEndRef} />
              </div>

              {/* Post comment form */}
              <form onSubmit={handlePostComment} className="flex items-start gap-3">
                {user?.avatar_url ? (
                  <Image
                    src={user.avatar_url}
                    alt={user.name}
                    width={32}
                    height={32}
                    className="rounded-full flex-shrink-0 mt-1"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-200 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-sm flex-shrink-0 mt-1">
                    {user?.name?.charAt(0).toUpperCase() || "?"}
                  </div>
                )}
                <div className="flex-1 flex gap-2">
                  <textarea
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    onKeyDown={(e) => {
                      // Ctrl/Cmd+Enter to submit
                      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                        handlePostComment(e as any);
                      }
                    }}
                    rows={2}
                    placeholder="Leave a comment… (Ctrl+Enter to send)"
                    className="flex-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl px-3.5 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400 dark:placeholder-gray-500"
                  />
                  <button
                    type="submit"
                    disabled={!commentBody.trim() || postingComment}
                    className="self-end px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition cursor-pointer"
                  >
                    {postingComment ? "Posting…" : "Send"}
                  </button>
                </div>
              </form>
            </div>

            {/* Activity Timeline */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-2">
                <span>🕒 Activity Timeline</span>
                <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
                  ({activities.length} events logged)
                </span>
              </h2>

              {activities.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">No activity recorded yet.</p>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200 dark:before:bg-gray-700">
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
                        <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-white dark:bg-gray-800 border-2 border-indigo-500 flex items-center justify-center text-[10px]">
                          {eventIcon}
                        </div>

                        <div className="flex-1 bg-gray-50 dark:bg-gray-700/40 rounded-xl p-3.5 border border-gray-100 dark:border-gray-700 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">
                              {act.actor_name || act.actor_email}
                            </span>
                            <span className="text-gray-400 dark:text-gray-500 text-[11px]">
                              {new Date(act.created_at).toLocaleString()}
                            </span>
                          </div>

                          <div className="mt-1 text-gray-700 dark:text-gray-300">
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
                                Status changed from{" "}
                                <code className="bg-white dark:bg-gray-800 px-1 py-0.5 rounded border dark:border-gray-600">{act.from_value}</code>{" "}
                                to{" "}
                                <code className="bg-white dark:bg-gray-800 px-1 py-0.5 rounded border dark:border-gray-600">{act.to_value}</code>
                              </span>
                            )}
                            {act.event_type === "completed" && (
                              <span className="text-green-700 dark:text-green-400 font-semibold">
                                ✓ Task completed!
                              </span>
                            )}
                            {act.event_type === "edited" && (
                              <span>{act.to_value || "Updated task details"}</span>
                            )}
                            {act.event_type === "commented" && (
                              <span>Left a comment</span>
                            )}
                            {act.event_type === "claimed" && (
                              <span>Claimed this pool task</span>
                            )}
                            {act.event_type === "released" && (
                              <span>Released this task back to the pool</span>
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
