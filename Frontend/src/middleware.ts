/**
 * Middleware — route protection
 *
 * Runs on every request (server-side, before the page renders).
 * Checks for the "token" cookie:
 *   - No token + protected route  → redirect to /login
 *   - Token present + /login      → redirect to /dashboard (already logged in)
 *
 * Note: We only check for the cookie's presence here. Full JWT verification
 * happens in Flask on every API call via the require_role decorator.
 */

import { NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("token");

  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  // Not logged in and trying to access a protected route → go to login
  if (!token && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Already logged in and hitting /login → go to dashboard
  if (token && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except Next.js internals and static assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

