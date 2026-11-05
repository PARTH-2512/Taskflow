"use client";

import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function DashboardPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const roleColor = {
    admin: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
    manager: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    user: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
  }[user.role];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Header */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 sm:p-8 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
                  Welcome back, {user.name}
                </h1>
                <span
                  className={`capitalize px-3 py-1 text-xs font-semibold rounded-full border ${roleColor}`}
                >
                  {user.role}
                </span>
              </div>
              <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">{user.email}</p>
            </div>

            <div className="text-right">
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500 block uppercase tracking-wider">
                Weekly Capacity
              </span>
              <span className="text-xl font-bold text-gray-800 dark:text-gray-200">
                {user.weekly_capacity_hours} hrs
              </span>
            </div>
          </div>
        </div>

        {/* Dashboard Role Features Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Card 1: To-Do / My Tasks */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 hover:shadow-md transition">
            <div className="h-10 w-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold mb-4">
              ✓
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">My Priority Tasks</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              View tasks assigned to you sorted by priority and due date.
            </p>
            <div className="mt-4">
              <Link
                href="/tasks/mine"
                className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 inline-flex items-center gap-1"
              >
                Go to My Tasks &rarr;
              </Link>
            </div>
          </div>

          {/* Card 2: Open Pool */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 hover:shadow-md transition">
            <div className="h-10 w-10 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold mb-4">
              ⚡
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Open Task Pool</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Claim available tasks to contribute and earn leaderboard points.
            </p>
            <div className="mt-4">
              <Link
                href="/pool"
                className="text-sm font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 inline-flex items-center gap-1"
              >
                Explore Pool &rarr;
              </Link>
            </div>
          </div>

          {/* Card 3: Role-specific action */}
          {user.role === "admin" && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 hover:shadow-md transition">
              <div className="h-10 w-10 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center font-bold mb-4">
                ⚙
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">User Management</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Promote users, assign roles (Admin/Manager), and toggle active status.
              </p>
              <div className="mt-4">
                <Link
                  href="/admin/users"
                  className="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 inline-flex items-center gap-1"
                >
                  Manage Users &rarr;
                </Link>
              </div>
            </div>
          )}

          {user.role === "manager" && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 hover:shadow-md transition">
              <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold mb-4">
                👥
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Team Workload</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Inspect capacity and assign new tasks with estimated hours.
              </p>
              <div className="mt-4">
                <Link
                  href="/team"
                  className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 inline-flex items-center gap-1"
                >
                  View Team &rarr;
                </Link>
              </div>
            </div>
          )}

          {user.role === "user" && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 hover:shadow-md transition">
              <div className="h-10 w-10 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold mb-4">
                🏆
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Points &amp; Leaderboard</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Check rankings and points accumulated from completed pool tasks.
              </p>
              <div className="mt-4">
                <Link
                  href="/leaderboard"
                  className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 inline-flex items-center gap-1"
                >
                  View Rankings &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Phase Status Notice */}
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl p-5 text-indigo-900 dark:text-indigo-300 flex items-start gap-3">
          <div className="text-lg font-bold">🚀</div>
          <div>
            <h3 className="font-semibold text-sm">Phase 8 Complete: Extras &amp; Polish</h3>
            <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-1">
              Comment threads, polling refresh, and dark/light mode are now live.
              Next up is <strong>Phase 9: Deploy &amp; Submit</strong>.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
