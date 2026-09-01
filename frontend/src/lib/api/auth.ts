import { apiRequest } from "./client";

export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string;
};

export type RegisterInput = {
  email: string;
  password: string;
  displayName: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export async function registerAccount(input: RegisterInput): Promise<AuthenticatedUser> {
  const user = await apiRequest<AuthenticatedUser>("/api/auth/register", {
    method: "POST",
    body: input,
  });
  return user!;
}

export async function login(input: LoginInput): Promise<AuthenticatedUser> {
  const user = await apiRequest<AuthenticatedUser>("/api/auth/login", {
    method: "POST",
    body: input,
  });
  return user!;
}

export async function logout(): Promise<void> {
  await apiRequest<void>("/api/auth/logout", { method: "POST" });
}

/** Restores the current session. Returns `null` when no one is signed in. */
export async function fetchCurrentUser(): Promise<AuthenticatedUser | null> {
  try {
    const user = await apiRequest<AuthenticatedUser>("/api/auth/me", { method: "GET" });
    return user ?? null;
  } catch (error) {
    if (isUnauthorized(error)) {
      return null;
    }
    throw error;
  }
}

function isUnauthorized(error: unknown): boolean {
  return typeof error === "object" && error !== null && "status" in error && error.status === 401;
}
