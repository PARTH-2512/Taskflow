"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { apiGet, apiPost } from "@/lib/api";
import { PoolData, PoolTask, TaskPriority } from "@/lib/types";

export default function OpenPoolPage() {
  const { user, loading: authLoading } = useAuth();

  const [poolData, setPoolData] = useState<PoolData>({
    unclaimed: [],
    my_claimed: [],
    active_claimed_count: 0,
    max_claim_limit: 3,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"available" | "my_claimed">("available");

  // Create Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPriority, setFormPriority] = useState<TaskPriority>(2);
  const [formEstHours, setFormEstHours] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Action loading state
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  function notify(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }

  async function loadPool() {
    try {
      setLoading(true);
      setError(null);
      const data = await apiGet<PoolData>("/pool");
      setPoolData(data);
    } catch (err: any) {
      setError(err.message || "Failed to load pool tasks");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) {
      loadPool();
    }
  }, [user]);

  async function handleClaim(taskId: string) {
    try {
      setActionLoadingId(taskId);
      await apiPost(`/pool/${taskId}/claim`);
      notify("Task successfully claimed! It is now on your to-do list.");
      await loadPool();
      setActiveTab("my_claimed");
    } catch (err: any) {
      alert(`Claim failed: ${err.message}`);
      loadPool();
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleRelease(taskId: string) {
    if (!confirm("Release this task back to the Open Pool? Any progress will reset to pending.")) return;

    try {
      setActionLoadingId(taskId);
      await apiPost(`/pool/${taskId}/release`);
      notify("Task released back to the Open Pool.");
      await loadPool();
    } catch (err: any) {
      alert(`Release failed: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleCreatePoolTask(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError("Title is required");
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);
      await apiPost("/pool", {
        title: formTitle.trim(),
        description: formDesc.trim() || null,
        priority: Number(formPriority),
        estimated_hours: formEstHours ? parseFloat(formEstHours) : null,
      });

      setIsModalOpen(false);
      setFormTitle("");
      setFormDesc("");
      setFormPriority(2);
      setFormEstHours("");
      notify("New Open Pool task created!");
      loadPool();
    } catch (err: any) {
      setFormError(err.message || "Failed to create pool task");
    } finally {
      setSubmitting(false);
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
  const pointsBadge = {
    3: "bg-purple-100 text-purple-800 border-purple-200",
    2: "bg-indigo-100 text-indigo-800 border-indigo-200",
    1: "bg-blue-100 text-blue-800 border-blue-200",
  };

  const isClaimLimitReached = poolData.active_claimed_count >= poolData.max_claim_limit;
  const canCreate = user?.role === "admin" || user?.role === "manager";
  const isRegularUser = user?.role === "user";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
                ⚡ Open Task Pool
              </h1>
              <span className="bg-amber-100 text-amber-800 border border-amber-200 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                Earn Points
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Claim optional tasks from the pool to earn points upon completion and rise on the leaderboard.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/leaderboard"
              className="px-3.5 py-2 text-sm font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-xl transition"
            >
              🏆 View Leaderboard
            </Link>

            {canCreate && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 bg-indigo-600 text-white font-medium text-sm rounded-xl shadow-sm hover:bg-indigo-700 transition cursor-pointer"
              >
                + Add Pool Task
              </button>
            )}
          </div>
        </div>

        {/* Success Toast */}
        {toastMsg && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium rounded-xl p-4 flex items-center gap-2">
            <span>✓</span>
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Claim Limit Indicator (For Users) */}
        {isRegularUser && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                🎯
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  Your Claim Limit: {poolData.active_claimed_count} / {poolData.max_claim_limit} Active Tasks
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  You can have up to 3 active claimed tasks simultaneously. Complete or release tasks to claim more.
                </p>
              </div>
            </div>

            {isClaimLimitReached ? (
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                Limit Reached
              </span>
            ) : (
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {poolData.max_claim_limit - poolData.active_claimed_count} Claim Slot(s) Available
              </span>
            )}
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 mb-6">
          <button
            onClick={() => setActiveTab("available")}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === "available"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            Available in Pool ({poolData.unclaimed.length})
          </button>
          <button
            onClick={() => setActiveTab("my_claimed")}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === "my_claimed"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            My Claimed Tasks ({poolData.my_claimed.length})
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Loading Open Pool...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
            {error}
          </div>
        ) : activeTab === "available" ? (
          /* Available Pool Tasks */
          poolData.unclaimed.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 text-center py-16 px-4">
              <div className="text-4xl mb-3">🏊</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">The Open Pool is currently empty</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {canCreate
                  ? "Click '+ Add Pool Task' above to add tasks for your team to claim!"
                  : "Check back later! Managers and Admins add pool tasks periodically."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {poolData.unclaimed.map((task) => {
                const isLoading = actionLoadingId === task.id;

                return (
                  <div
                    key={task.id}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          {priorityLabel[task.priority]} Priority
                        </span>

                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                            pointsBadge[task.priority]
                          }`}
                        >
                          +{task.potential_points} Points
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">
                        {task.title}
                      </h3>

                      {task.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3 mb-4">
                          {task.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {task.estimated_hours ? `⏱ ~${task.estimated_hours} hrs` : "Flexible effort"}
                        <span className="mx-1.5">•</span>
                        <span>By {task.creator_name || "Manager"}</span>
                      </div>

                      {isRegularUser ? (
                        <button
                          onClick={() => handleClaim(task.id)}
                          disabled={isLoading || isClaimLimitReached}
                          className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition cursor-pointer disabled:opacity-50"
                        >
                          {isLoading ? "Claiming..." : "⚡ Claim Task"}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                          Users only
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* My Claimed Tasks */
          poolData.my_claimed.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 text-center py-16 px-4">
              <div className="text-4xl mb-3">📋</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">No active claimed pool tasks</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Explore the &quot;Available in Pool&quot; tab to claim tasks and earn points.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {poolData.my_claimed.map((task) => {
                const isLoading = actionLoadingId === task.id;

                return (
                  <div
                    key={task.id}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-amber-200 dark:border-amber-800/60 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          Active Claim
                        </span>
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                            pointsBadge[task.priority]
                          }`}
                        >
                          +{task.potential_points} Points on completion
                        </span>
                      </div>

                      <Link
                        href={`/tasks/${task.id}`}
                        className="text-base font-bold text-gray-900 dark:text-gray-100 hover:text-indigo-600 transition block"
                      >
                        {task.title}
                      </Link>

                      {task.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                        Claimed {task.claimed_at ? new Date(task.claimed_at).toLocaleDateString() : "recently"}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/tasks/${task.id}`}
                        className="px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition"
                      >
                        View &amp; Complete &rarr;
                      </Link>

                      <button
                        onClick={() => handleRelease(task.id)}
                        disabled={isLoading}
                        className="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition cursor-pointer disabled:opacity-50"
                      >
                        {isLoading ? "Releasing..." : "Release to Pool"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Modal: Create Pool Task */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 max-w-lg w-full p-6">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Create Open Pool Task</h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3">
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreatePoolTask} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Task Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Write integration test suite"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Requirements and expectations for whoever claims this task..."
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Priority &amp; Points Awarded
                    </label>
                    <select
                      value={formPriority}
                      onChange={(e) => setFormPriority(Number(e.target.value) as TaskPriority)}
                      className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value={1}>Low — 5 points</option>
                      <option value={2}>Medium — 10 points</option>
                      <option value={3}>High — 20 points</option>
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
                      placeholder="e.g. 3.0"
                      value={formEstHours}
                      onChange={(e) => setFormEstHours(e.target.value)}
                      className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

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
                    disabled={submitting}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? "Creating..." : "Publish to Pool"}
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
