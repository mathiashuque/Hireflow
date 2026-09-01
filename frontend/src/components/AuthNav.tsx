"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";

export function AuthNav() {
  const { status, user, logout } = useAuth();

  if (status === "loading") {
    return <span className="text-sm text-slate-500">Loading…</span>;
  }

  if (status === "authenticated" && user) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          Dashboard
        </Link>
        <button
          type="button"
          onClick={() => void logout()}
          className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          Log out
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/login"
        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      >
        Log in
      </Link>
      <Link
        href="/register"
        className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      >
        Sign up
      </Link>
    </div>
  );
}
