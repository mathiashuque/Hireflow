"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function DashboardPage() {
  const { status, user, logout, retry } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-sm text-slate-500">Loading your account…</p>
      </main>
    );
  }

  if (status === "unavailable") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="max-w-sm text-sm text-slate-600">
          Hireflow can&apos;t reach the API right now. Check that the backend is running
          and try again.
        </p>
        <button
          type="button"
          onClick={retry}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          Try again
        </button>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 sm:px-10">
      <nav className="flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-950">
          Hireflow
        </Link>
        <button
          type="button"
          onClick={() => void logout()}
          className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          Log out
        </button>
      </nav>

      <section className="flex flex-1 flex-col justify-center gap-6 py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
          Welcome
        </p>
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
            {user.displayName}
          </h1>
          <p className="mt-2 text-slate-600">{user.email}</p>
        </div>
        <p className="max-w-2xl text-sm text-slate-500">
          Workspaces, job openings, and candidates land here next. For now, this
          confirms your session is authenticated end to end.
        </p>
      </section>
    </main>
  );
}
