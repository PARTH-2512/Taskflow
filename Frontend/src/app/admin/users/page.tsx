"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { apiGet, apiPatch } from "@/lib/api";
import { User, Role } from "@/lib/types";

export default function AdminUsersPage() {
  const { user: currentUser, loading: authLoading, refreshUser } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function loadUsers() {
    try {
      setLoading(true);
      setError(null);
      const data = await apiGet<User[]>("/users?include_inactive=true");
      setUsers(data);
    } catch (err: any) {
      setError(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (currentUser && currentUser.role === "admin") {
      loadUsers();
    }
  }, [currentUser]);

  function notify(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  }

  async function handleRoleChange(targetUser: User, newRole: Role) {
    if (targetUser.role === newRole) return;
    if (targetUser.id === currentUser?.id && newRole !== "admin") {
      alert("You cannot demote your own admin account.");
      return;
    }

    try {
      setUpdatingId(targetUser.id);
      const updated = await apiPatch<User>(`/users/${targetUser.id}`, { role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, role: updated.role } : u))
      );
      notify(`Role updated to ${newRole.toUpperCase()} for ${targetUser.name}`);
      if (targetUser.id === currentUser?.id) {
        await refreshUser();
      }
    } catch (err: any) {
      alert(`Could not change role: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleToggleActive(targetUser: User) {
    if (targetUser.id === currentUser?.id) {
      alert("You cannot deactivate your own account.");
      return;
    }

    const nextState = !targetUser.is_active;
    const actionLabel = nextState ? "activate" : "deactivate";

    if (!confirm(`Are you sure you want to ${actionLabel} ${targetUser.name}?`)) return;

    try {
      setUpdatingId(targetUser.id);
      const updated = await apiPatch<User>(`/users/${targetUser.id}`, { is_active: nextState });
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, is_active: updated.is_active } : u))
      );
      notify(`Account for ${targetUser.name} has been ${nextState ? "activated" : "deactivated"}.`);
    } catch (err: any) {
      alert(`Operation failed: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleCapacityChange(targetUser: User, hours: number) {
    if (hours <= 0 || isNaN(hours)) return;
    try {
      setUpdatingId(targetUser.id);
      const updated = await apiPatch<User>(`/users/${targetUser.id}`, { weekly_capacity_hours: hours });
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, weekly_capacity_hours: updated.weekly_capacity_hours } : u))
      );
      notify(`Updated weekly capacity to ${hours} hrs for ${targetUser.name}`);
    } catch (err: any) {
      alert(`Could not update capacity: ${err.message}`);
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

  // Admin access guard
  if (!currentUser || currentUser.role !== "admin") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-lg mx-auto px-4 py-16 text-center">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="text-4xl mb-3">🔒</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Admin Privileges Required</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
              Only users with the Admin role can manage accounts and roles.
            </p>
            <div className="mt-6">
              <Link
                href="/dashboard"
                className="inline-flex px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter ? u.role === roleFilter : true;
    const matchStatus =
      statusFilter === "active"
        ? u.is_active === true
        : statusFilter === "inactive"
        ? u.is_active === false
        : true;
    return matchSearch && matchRole && matchStatus;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              Admin Role Management
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Promote users to Manager/Admin, adjust weekly capacity, and manage account statuses.
            </p>
          </div>
        </div>

        {/* Success toast */}
        {successMsg && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium rounded-xl p-4 flex items-center gap-2">
            <span>✓</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm mb-6 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search by user name or email..."
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

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Deactivated Only</option>
          </select>
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Loading user directory...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
            {error}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 text-center py-12 text-gray-500 dark:text-gray-400 text-sm">
            No users found matching your filters.
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/40 text-gray-500 dark:text-gray-400 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-6 py-3.5">
                      User
                    </th>
                    <th scope="col" className="px-6 py-3.5">
                      Role
                    </th>
                    <th scope="col" className="px-6 py-3.5">
                      Weekly Capacity
                    </th>
                    <th scope="col" className="px-6 py-3.5">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3.5 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                  {filteredUsers.map((target) => {
                    const isSelf = target.id === currentUser.id;
                    const isUpdating = updatingId === target.id;

                    return (
                      <tr key={target.id} className="hover:bg-gray-50/75 dark:hover:bg-gray-700/40 transition">
                        {/* User column */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            {target.avatar_url ? (
                              <Image
                                src={target.avatar_url}
                                alt=""
                                width={36}
                                height={36}
                                className="rounded-full"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                                {target.name.charAt(0).toUpperCase()}
                              </div>
                            )}

                            <div>
                              <div className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                <span>{target.name}</span>
                                {isSelf && (
                                  <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded font-normal">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{target.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Role Selector */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={target.role}
                            disabled={isSelf || isUpdating}
                            onChange={(e) => handleRoleChange(target, e.target.value as Role)}
                            className="text-xs font-semibold rounded-lg px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer disabled:opacity-60"
                          >
                            <option value="user">User</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>

                        {/* Weekly Capacity Hours */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="1"
                              max="168"
                              step="5"
                              defaultValue={target.weekly_capacity_hours}
                              disabled={isUpdating}
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value);
                                if (val !== target.weekly_capacity_hours && val > 0) {
                                  handleCapacityChange(target, val);
                                }
                              }}
                              className="w-18 text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                            <span className="text-xs text-gray-500 dark:text-gray-400">hrs/wk</span>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              target.is_active
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
                            }`}
                          >
                            {target.is_active ? "● Active" : "○ Deactivated"}
                          </span>
                        </td>

                        {/* Action: Activate / Deactivate */}
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => handleToggleActive(target)}
                            disabled={isSelf || isUpdating}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer disabled:opacity-40 ${
                              target.is_active
                                ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
                                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                          >
                            {target.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
