/**
 * Root page — immediately redirect to /dashboard.
 * Middleware will redirect to /login if not authenticated.
 */
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/dashboard");
}

