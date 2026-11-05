"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { apiGet } from "@/lib/api";
import { User } from "@/lib/types";

export default function TeamWorkloadPage() {
  const { user, loading: authLoading } = useAuth();
  const [team, setTeam] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  async function loadTeam() {
    try {
      setLoading(true);
      setError(null);
      const data = await apiGet<User[]>("/users");
      setTeam(data);
    } catch (err: any) {
      setError(err.message || "Failed to load team data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) {
      loadTeam();
    }
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const filteredTeam = team.filter((member) => {
    const matchName =
      member.name.toLowerCase().includes(search.toLowerCase()) ||
      member.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter ? member.role === roleFilter : true;
    return matchName && matchRole;
  });

  // Calculate aggregates
  const totalOpenTasks = team.reduce((acc, m) => acc + (m.open_tasks || 0), 0);
  const totalOpenHours = team.reduce((acc, m) => acc + (m.open_hours || 0), 0);
  const availableCount = team.filter((m) => m.capacity_status === "available").length;
  const busyCount = team.filter((m) => m.capacity_status === "busy").length;
  const overloadedCount = team.filter((m) => m.capacity_status === "overloaded").length;

  const roleBadge = {
    admin: "bg-red-50 text-red-700 border-red-200",
    manager: "bg-blue-50 text-blue-700 border-blue-200",
    user: "bg-green-50 text-green-700 border-green-200",
  };

  const capacityBadge = {
    available: "bg-emerald-50 text-emerald-700 border-emerald-200",
    busy: "bg-amber-50 text-amber-700 border-amber-200",
    overloaded: "bg-rose-50 text-rose-700 border-rose-200 animate-pulse",
  };

  const progressBarColor = {
    available: "bg-emerald-500",
    busy: "bg-amber-500",
    overloaded: "bg-rose-500",
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              Team Workload &amp; Capacity
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Live capacity metrics based on active tasks and estimated hours.
            </p>
          </div>

          {(user?.role === "admin" || user?.role === "manager") && (
            <Link
              href="/tasks"
              className="inline-flex items-center justify-center px-4 py-2.5 bg-indigo-600 text-white font-medium text-sm rounded-xl shadow-sm hover:bg-indigo-700 transition"
            >
              + Assign Task
            </Link>
          )}
        </div>

        {/* Aggregates Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">Team Members</span>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{team.length}</div>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">Active accounts</span>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">Open Tasks</span>
            <div className="text-2xl font-bold text-indigo-600 mt-1">{totalOpenTasks}</div>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">In progress or pending</span>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">Total Open Hours</span>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{totalOpenHours} hrs</div>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">Estimated effort</span>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">Capacity Health</span>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700">
                {availableCount} Avail
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700">
                {busyCount} Busy
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700">
                {overloadedCount} Over
              </span>
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500 mt-1 block">Thresholds: 60% &amp; 100%</span>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm mb-6 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search member by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="user">User</option>
          </select>
        </div>

        {/* Workload Table / Cards */}
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Calculating team workloads...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
            {error}
          </div>
        ) : filteredTeam.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 text-center py-12 text-gray-500 dark:text-gray-400 text-sm">
            No team members found matching your search.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTeam.map((member) => {
              const openHours = member.open_hours || 0;
              const capacityHours = member.weekly_capacity_hours || 40;
              const pct = Math.min(Math.round((openHours / capacityHours) * 100), 100);
              const status = member.capacity_status || "available";

              return (
                <div
                  key={member.id}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {member.avatar_url ? (
                        <Image
                          src={member.avatar_url}
                          alt=""
                          width={44}
                          height={44}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-base">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div>
                        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 leading-snug">
                          {member.name}
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{member.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`capitalize px-2 py-0.5 rounded-full text-xs font-semibold border ${
                          roleBadge[member.role]
                        }`}
                      >
                        {member.role}
                      </span>
                      <span
                        className={`capitalize px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          capacityBadge[status]
                        }`}
                      >
                        {status}
                      </span>
                    </div>
                  </div>

                  {/* Workload Progress */}
                  <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-gray-500 dark:text-gray-400">
                        {member.open_tasks || 0} open task{(member.open_tasks || 0) === 1 ? "" : "s"}
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {openHours} / {capacityHours} hrs ({pct}%)
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${
                          progressBarColor[status]
                        }`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      ></div>
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
