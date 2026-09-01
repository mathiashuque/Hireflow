"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ApiUnavailableError } from "@/lib/api/client";
import { listWorkspaces, type WorkspaceDetail, type WorkspaceSummary } from "@/lib/api/workspaces";
import { WorkspaceCreateForm } from "@/components/WorkspaceCreateForm";

type WorkspacesState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "error" }
  | { status: "ready"; workspaces: WorkspaceSummary[] };

export default function DashboardPage() {
  const { status: authStatus, user, logout, retry: retryAuth } = useAuth();
  const router = useRouter();
  const [workspacesState, setWorkspacesState] = useState<WorkspacesState>({ status: "loading" });

  const fetchWorkspaces = useCallback(async (): Promise<WorkspacesState> => {
    try {
      const workspaces = await listWorkspaces();
      return { status: "ready", workspaces };
    } catch (error) {
      return { status: error instanceof ApiUnavailableError ? "unavailable" : "error" };
    }
  }, []);

  const retryWorkspaces = useCallback(() => {
    setWorkspacesState({ status: "loading" });
    void fetchWorkspaces().then(setWorkspacesState);
  }, [fetchWorkspaces]);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.replace("/login");
    }
  }, [authStatus, router]);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      return;
    }

    let cancelled = false;
    void fetchWorkspaces().then((result) => {
      if (!cancelled) {
        setWorkspacesState(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [authStatus, fetchWorkspaces]);

  if (authStatus === "loading" || authStatus === "unauthenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-sm text-slate-500">Loading your account…</p>
      </main>
    );
  }

  if (authStatus === "unavailable") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="max-w-sm text-sm text-slate-600">
          Hireflow can&apos;t reach the API right now. Check that the backend is running
          and try again.
        </p>
        <button
          type="button"
          onClick={retryAuth}
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

  function handleCreated(workspace: WorkspaceDetail) {
    router.push(`/workspaces/${workspace.id}`);
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

      <section className="flex flex-1 flex-col gap-10 py-12">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">Welcome</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{user.displayName}</h1>
        </div>

        <WorkspacesSection state={workspacesState} onCreated={handleCreated} onRetry={retryWorkspaces} />
      </section>
    </main>
  );
}

function WorkspacesSection({
  state,
  onCreated,
  onRetry,
}: {
  state: WorkspacesState;
  onCreated: (workspace: WorkspaceDetail) => void;
  onRetry: () => void;
}) {
  if (state.status === "loading") {
    return <p className="text-sm text-slate-500">Loading your workspaces…</p>;
  }

  if (state.status === "unavailable" || state.status === "error") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
        <p className="text-sm text-slate-600">
          {state.status === "unavailable"
            ? "Hireflow can't reach the API right now. Check that the backend is running and try again."
            : "Something went wrong loading your workspaces."}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          Try again
        </button>
      </div>
    );
  }

  if (state.workspaces.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold text-slate-950">You&apos;re not in a workspace yet</h2>
          <p className="mt-2 text-sm text-slate-600">
            A workspace is where your team&apos;s job openings, candidates, and hiring activity
            live. Create one to get started, or ask a teammate to invite you to theirs.
          </p>
        </div>
        <WorkspaceCreateForm onCreated={onCreated} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {state.workspaces.map((workspace) => (
          <li key={workspace.id}>
            <Link
              href={`/workspaces/${workspace.id}`}
              className="block rounded-xl border border-slate-200 bg-white px-4 py-4 transition hover:border-indigo-300 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            >
              <p className="font-medium text-slate-950">{workspace.name}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{workspace.role}</p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="max-w-sm">
        <h2 className="text-sm font-semibold text-slate-950">Create another workspace</h2>
        <div className="mt-3">
          <WorkspaceCreateForm onCreated={onCreated} />
        </div>
      </div>
    </div>
  );
}
