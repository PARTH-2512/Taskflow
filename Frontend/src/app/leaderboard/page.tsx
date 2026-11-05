"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { apiGet } from "@/lib/api";
import { LeaderboardEntry, MyPointsData } from "@/lib/types";

export default function LeaderboardPage() {
  const { user, loading: authLoading } = useAuth();

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myPoints, setMyPoints] = useState<MyPointsData>({
    total_points: 0,
    history: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"ranking" | "history">("ranking");

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const [boardData, myData] = await Promise.all([
        apiGet<LeaderboardEntry[]>("/points/leaderboard"),
        apiGet<MyPointsData>("/points/me").catch(() => ({ total_points: 0, history: [] })),
      ]);

      setLeaderboard(boardData);
      setMyPoints(myData);
    } catch (err: any) {
      setError(err.message || "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const myRankEntry = leaderboard.find((e) => e.user_id === user?.id);
  const topThree = leaderboard.slice(0, 3);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <span>🏆 Points Leaderboard</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Rankings of team members based on points earned from completing Open Pool tasks.
            </p>
          </div>

          <Link
            href="/pool"
            className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white font-medium text-sm rounded-xl shadow-sm hover:bg-indigo-700 transition"
          >
            ⚡ Claim Pool Tasks
          </Link>
        </div>

        {/* My Performance Card */}
        <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 text-white rounded-2xl p-6 shadow-sm mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <span className="text-xs uppercase tracking-wider text-indigo-300 font-semibold">
                Your Standings
              </span>
              <h2 className="text-2xl font-bold mt-1">{user?.name}</h2>
              <p className="text-xs text-indigo-200 mt-0.5">{user?.email}</p>
            </div>

            <div className="flex items-center gap-6 text-center sm:text-right">
              <div>
                <span className="text-xs text-indigo-300 block">Total Points</span>
                <span className="text-3xl font-black text-amber-400">
                  {myPoints.total_points}
                </span>
              </div>

              <div className="h-10 w-px bg-indigo-700"></div>

              <div>
                <span className="text-xs text-indigo-300 block">Global Rank</span>
                <span className="text-3xl font-black text-white">
                  {myRankEntry ? `#${myRankEntry.rank}` : "—"}
                </span>
              </div>

              <div className="h-10 w-px bg-indigo-700"></div>

              <div>
                <span className="text-xs text-indigo-300 block">Completed Pool Tasks</span>
                <span className="text-3xl font-black text-white">
                  {myPoints.history.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab("ranking")}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === "ranking"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Leaderboard Rankings
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === "history"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            My Points Ledger ({myPoints.history.length})
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="text-sm text-gray-500 mt-2">Loading leaderboard scores...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
            {error}
          </div>
        ) : activeTab === "ranking" ? (
          /* Rankings Tab */
          <div>
            {/* Top 3 Podium (if at least 2 users) */}
            {topThree.length >= 2 && (
              <div className="grid grid-cols-3 gap-3 sm:gap-6 mb-8 text-center items-end">
                {/* 2nd Place */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-col items-center">
                  <div className="text-2xl mb-1">🥈</div>
                  <div className="font-bold text-sm text-gray-900 truncate max-w-full">
                    {topThree[1].name}
                  </div>
                  <div className="text-xs text-indigo-600 font-extrabold mt-1">
                    {topThree[1].total_points} pts
                  </div>
                  <span className="text-[10px] uppercase font-semibold text-gray-400 mt-0.5">
                    2nd Place
                  </span>
                </div>

                {/* 1st Place (Taller) */}
                <div className="bg-gradient-to-b from-amber-50 to-white rounded-2xl border-2 border-amber-300 p-5 shadow-md flex flex-col items-center transform -translate-y-2">
                  <div className="text-3xl mb-1">🥇</div>
                  <div className="font-extrabold text-base text-gray-900 truncate max-w-full">
                    {topThree[0].name}
                  </div>
                  <div className="text-sm text-amber-600 font-black mt-1">
                    {topThree[0].total_points} pts
                  </div>
                  <span className="text-[10px] uppercase font-bold text-amber-700 mt-0.5">
                    Champion
                  </span>
                </div>

                {/* 3rd Place */}
                {topThree[2] ? (
                  <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-col items-center">
                    <div className="text-2xl mb-1">🥉</div>
                    <div className="font-bold text-sm text-gray-900 truncate max-w-full">
                      {topThree[2].name}
                    </div>
                    <div className="text-xs text-indigo-600 font-extrabold mt-1">
                      {topThree[2].total_points} pts
                    </div>
                    <span className="text-[10px] uppercase font-semibold text-gray-400 mt-0.5">
                      3rd Place
                    </span>
                  </div>
                ) : (
                  <div></div>
                )}
              </div>
            )}

            {/* Full Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-6 py-3.5 w-16 text-center">
                      Rank
                    </th>
                    <th scope="col" className="px-6 py-3.5">
                      User
                    </th>
                    <th scope="col" className="px-6 py-3.5 text-right">
                      Points Earned
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {leaderboard.map((entry) => {
                    const isMe = entry.user_id === user?.id;

                    const rankIcon =
                      entry.rank === 1
                        ? "🥇"
                        : entry.rank === 2
                        ? "🥈"
                        : entry.rank === 3
                        ? "🥉"
                        : `#${entry.rank}`;

                    return (
                      <tr
                        key={entry.user_id}
                        className={`transition ${isMe ? "bg-indigo-50/50 font-medium" : "hover:bg-gray-50/75"}`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-center font-bold text-gray-700">
                          {rankIcon}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            {entry.avatar_url ? (
                              <Image
                                src={entry.avatar_url}
                                alt=""
                                width={32}
                                height={32}
                                className="rounded-full"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                                {entry.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900">{entry.name}</span>
                              {isMe && (
                                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold">
                                  You
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-base font-extrabold text-indigo-600">
                            {entry.total_points}
                          </span>
                          <span className="text-xs text-gray-400 ml-1">pts</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Points Ledger History Tab */
          <div>
            {myPoints.history.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 text-center py-16 px-4">
                <div className="text-4xl mb-3">🪙</div>
                <h3 className="text-lg font-semibold text-gray-900">No points earned yet</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Claim an Open Pool task and mark it complete to earn your first points!
                </p>
                <div className="mt-4">
                  <Link
                    href="/pool"
                    className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700"
                  >
                    Browse Open Pool &rarr;
                  </Link>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="divide-y divide-gray-100">
                  {myPoints.history.map((item) => (
                    <div key={item.id} className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <h4 className="font-semibold text-sm text-gray-900">
                          {item.task_title}
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {item.reason} • {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-bold text-xs">
                        +{item.points} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

