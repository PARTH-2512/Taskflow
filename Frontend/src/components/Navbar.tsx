"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Role } from "@/lib/types";

interface NavLinkItem {
  href: string;
  label: string;
  roles: Role[];
}

/** Navigation links visible per role. Admin/Manager see more. */
const NAV_LINKS: NavLinkItem[] = [
  { href: "/dashboard", label: "Dashboard", roles: ["admin", "manager", "user"] },
  { href: "/tasks/mine", label: "My Tasks", roles: ["admin", "manager", "user"] },
  { href: "/tasks", label: "Created Tasks", roles: ["admin", "manager", "user"] },
  { href: "/team", label: "Team", roles: ["admin", "manager", "user"] },
  { href: "/pool", label: "Open Pool", roles: ["admin", "manager", "user"] },
  { href: "/leaderboard", label: "Leaderboard", roles: ["admin", "manager", "user"] },
  { href: "/admin/users", label: "Users", roles: ["admin"] },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();

  if (!user) return null;

  const visibleLinks = NAV_LINKS.filter((l) =>
    l.roles.includes(user.role)
  );

  return (
    <nav className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
              TaskFlow
            </Link>

            {/* Nav links */}
            <div className="hidden md:flex items-center gap-1">
              {visibleLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right side: role badge + theme toggle + avatar + logout */}
          <div className="flex items-center gap-3">
            {/* Role badge */}
            <span
              className={`hidden sm:inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                user.role === "admin"
                  ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                  : user.role === "manager"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                  : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
              }`}
            >
              {user.role}
            </span>

            {/* Dark/Light mode toggle */}
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                // Sun icon
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                // Moon icon
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Avatar */}
            {user.avatar_url ? (
              <Image
                src={user.avatar_url}
                alt={user.name}
                width={32}
                height={32}
                className="rounded-full"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-indigo-200 dark:bg-indigo-800 flex items-center justify-center text-indigo-700 dark:text-indigo-300 text-sm font-semibold">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Logout */}
            <button
              onClick={logout}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
