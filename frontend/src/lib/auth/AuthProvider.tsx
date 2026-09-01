"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  type AuthenticatedUser,
  type LoginInput,
  type RegisterInput,
  fetchCurrentUser,
  login as apiLogin,
  logout as apiLogout,
  registerAccount as apiRegister,
} from "@/lib/api/auth";
import { ApiUnavailableError } from "@/lib/api/client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "unavailable";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  retry: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

  // Resolves the session without touching state itself, so callers decide when to
  // show "loading" (an effect can apply the result after the fact; an explicit retry
  // can flip to "loading" immediately for feedback).
  const resolveSession = useCallback(async (): Promise<{
    status: AuthStatus;
    user: AuthenticatedUser | null;
  }> => {
    try {
      const currentUser = await fetchCurrentUser();
      return { status: currentUser ? "authenticated" : "unauthenticated", user: currentUser };
    } catch (error) {
      return {
        status: error instanceof ApiUnavailableError ? "unavailable" : "unauthenticated",
        user: null,
      };
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void resolveSession().then((result) => {
      if (!cancelled) {
        setStatus(result.status);
        setUser(result.user);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [resolveSession]);

  const retry = useCallback(() => {
    setStatus("loading");
    void resolveSession().then((result) => {
      setStatus(result.status);
      setUser(result.user);
    });
  }, [resolveSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      async login(input) {
        const authenticatedUser = await apiLogin(input);
        setUser(authenticatedUser);
        setStatus("authenticated");
      },
      async register(input) {
        const authenticatedUser = await apiRegister(input);
        setUser(authenticatedUser);
        setStatus("authenticated");
      },
      async logout() {
        await apiLogout();
        setUser(null);
        setStatus("unauthenticated");
      },
      retry,
    }),
    [status, user, retry],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
