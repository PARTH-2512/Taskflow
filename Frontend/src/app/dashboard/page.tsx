"use client";

import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function DashboardPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const roleColor = {
    admin: "bg-red-50 text-red-700 border-red-200",
    manager: "bg-blue-50 text-blue-700 border-blue-200",
    user: "bg-green-50 text-green-700 border-green-200",
  }[user.role];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  Welcome back, {user.name}
                </h1>
                <span
                  className={`capitalize px-3 py-1 text-xs font-semibold rounded-full border ${roleColor}`}
                >
                  {user.role}
                </span>
              </div>
              <p className="text-gray-500 mt-1 text-sm">{user.email}</p>
            </div>

            <div className="text-right">
              <span className="text-xs font-medium text-gray-400 block uppercase tracking-wider">
                Weekly Capacity
              </span>
              <span className="text-xl font-bold text-gray-800">
                {user.weekly_capacity_hours} hrs
              </span>
            </div>
          </div>
        </div>

        {/* Dashboard Role Features Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Card 1: To-Do / My Tasks */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition">
            <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold mb-4">
              ✓
            </div>
            <h2 className="text-lg font-semibold text-gray-900">My Priority Tasks</h2>
            <p className="text-sm text-gray-500 mt-1">
              View tasks assigned to you sorted by priority and due date.
            </p>
            <div className="mt-4">
              <Link
                href="/tasks/mine"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
              >
                Go to My Tasks &rarr;
              </Link>
            </div>
          </div>

          {/* Card 2: Open Pool */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition">
            <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold mb-4">
              ⚡
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Open Task Pool</h2>
            <p className="text-sm text-gray-500 mt-1">
              Claim available tasks to contribute and earn leaderboard points.
            </p>
            <div className="mt-4">
              <Link
                href="/pool"
                className="text-sm font-medium text-amber-600 hover:text-amber-700 inline-flex items-center gap-1"
              >
                Explore Pool &rarr;
              </Link>
            </div>
          </div>

          {/* Card 3: Role-specific action */}
          {user.role === "admin" && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition">
              <div className="h-10 w-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center font-bold mb-4">
                ⚙
              </div>
              <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
              <p className="text-sm text-gray-500 mt-1">
                Promote users, assign roles (Admin/Manager), and toggle active status.
              </p>
              <div className="mt-4">
                <Link
                  href="/admin/users"
                  className="text-sm font-medium text-red-600 hover:text-red-700 inline-flex items-center gap-1"
                >
                  Manage Users &rarr;
                </Link>
              </div>
            </div>
          )}

          {user.role === "manager" && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition">
              <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-4">
                👥
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Team Workload</h2>
              <p className="text-sm text-gray-500 mt-1">
                Inspect capacity and assign new tasks with estimated hours.
              </p>
              <div className="mt-4">
                <Link
                  href="/team"
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                >
                  View Team &rarr;
                </Link>
              </div>
            </div>
          )}

          {user.role === "user" && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition">
              <div className="h-10 w-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold mb-4">
                🏆
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Points & Leaderboard</h2>
              <p className="text-sm text-gray-500 mt-1">
                Check rankings and points accumulated from completed pool tasks.
              </p>
              <div className="mt-4">
                <Link
                  href="/leaderboard"
                  className="text-sm font-medium text-purple-600 hover:text-purple-700 inline-flex items-center gap-1"
                >
                  View Rankings &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Phase Status Notice */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 text-indigo-900 flex items-start gap-3">
          <div className="text-lg font-bold">🚀</div>
          <div>
            <h3 className="font-semibold text-sm">Phase 3 Complete: Authentication & Role Guard Active</h3>
            <p className="text-xs text-indigo-700 mt-1">
              Google OAuth authentication, protected cookies, and role-based navigation are fully connected.
              Next up is <strong>Phase 4: Task Core</strong> (task creation, assignment, priority to-do list, and status updates).
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

