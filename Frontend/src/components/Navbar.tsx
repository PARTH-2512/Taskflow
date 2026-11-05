"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
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
  { href: "/tasks", label: "All Tasks", roles: ["admin", "manager"] },
  { href: "/team", label: "Team", roles: ["admin", "manager", "user"] },
  { href: "/pool", label: "Open Pool", roles: ["admin", "manager", "user"] },
  { href: "/leaderboard", label: "Leaderboard", roles: ["admin", "manager", "user"] },
  { href: "/admin/users", label: "Users", roles: ["admin"] },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const visibleLinks = NAV_LINKS.filter((l) =>
    l.roles.includes(user.role)
  );

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-xl font-bold text-indigo-600">
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
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right side: role badge + avatar + logout */}
          <div className="flex items-center gap-4">
            {/* Role badge */}
            <span
              className={`hidden sm:inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                user.role === "admin"
                  ? "bg-red-100 text-red-700"
                  : user.role === "manager"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {user.role}
            </span>

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
              <div className="h-8 w-8 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 text-sm font-semibold">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Logout */}
            <button
              onClick={logout}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
