"use client";

/**
 * AuthContext
 * -----------
 * Fetches the current user from GET /auth/me on every page load.
 * Stores the result in React context so any component can call useAuth().
 *
 * Because the JWT lives in an httpOnly cookie (invisible to JS), the only
 * way to know if the user is logged in is to call the backend.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { User } from "@/lib/types";
import { apiGet } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  /** Call after a role change so the context refreshes without a full page reload */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  async function fetchUser() {
    try {
      const me = await apiGet<User>("/auth/me");
      setUser(me);
    } catch {
      // 401 or network error — treat as unauthenticated
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUser();
  }, []);

  async function logout() {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {}); // best-effort
    setUser(null);
    router.push("/login");
  }

  async function refreshUser() {
    await fetchUser();
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

