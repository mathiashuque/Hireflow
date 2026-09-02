"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ApiUnavailableError } from "@/lib/api/client";
import { getWorkspaceOverview, type WorkspaceOverview } from "@/lib/api/overview";
import { WorkspaceNav } from "@/components/WorkspaceNav";
import { OverviewMetricsCards } from "@/components/OverviewMetricsCards";
import { JobWorkloadList } from "@/components/JobWorkloadList";
import { RecentActivityFeed } from "@/components/RecentActivityFeed";

type PageState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; overview: WorkspaceOverview };

export default function WorkspaceOverviewPage(props: PageProps<"/workspaces/[workspaceId]">) {
  const { workspaceId } = use(props.params);
  const { status: authStatus, user } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<PageState>({ status: "loading" });

  const fetchState = useCallback(async (): Promise<PageState> => {
    try {
      const overview = await getWorkspaceOverview(workspaceId);
      if (!overview) {
        return { status: "not-found" };
      }

      return { status: "ready", overview };
    } catch (error) {
      return { status: error instanceof ApiUnavailableError ? "unavailable" : "error" };
    }
  }, [workspaceId]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    void fetchState().then(setState);
  }, [fetchState]);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.replace("/login");
    }
  }, [authStatus, router]);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      return;
    }

    // Every render of this effect belongs to the current workspaceId only; a route
    // change to a different workspace cancels the in-flight fetch instead of letting
    // its result render under the new route.
    let cancelled = false;
    void fetchState().then((result) => {
      if (!cancelled) {
        setState(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [authStatus, fetchState]);

  if (authStatus === "loading" || authStatus === "unauthenticated" || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-sm text-slate-500">Loading your account…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-8 sm:px-10">
      <nav className="flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-950">
          Hireflow
        </Link>
        <Link href="/dashboard" className="text-sm font-medium text-indigo-600 hover:underline">
          Back to workspaces
        </Link>
      </nav>

      <section className="flex-1 py-12">
        {state.status === "loading" && <p className="text-sm text-slate-500">Loading overview…</p>}

        {state.status === "not-found" && (
          <div className="max-w-md">
            <h1 className="text-xl font-semibold text-slate-950">Workspace unavailable</h1>
            <p className="mt-2 text-sm text-slate-600">
              This workspace doesn&apos;t exist, or you don&apos;t have access to it.
            </p>
            <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
              Back to your workspaces
            </Link>
          </div>
        )}

        {(state.status === "unavailable" || state.status === "error") && (
          <div className="flex max-w-md flex-col items-start gap-3">
            <p className="text-sm text-slate-600">
              {state.status === "unavailable"
                ? "Hireflow can't reach the API right now. Check that the backend is running and try again."
                : "Something went wrong loading this workspace."}
            </p>
            <button
              type="button"
              onClick={retry}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            >
              Try again
            </button>
          </div>
        )}

        {state.status === "ready" && <WorkspaceOverviewContent overview={state.overview} />}
      </section>
    </main>
  );
}

function WorkspaceOverviewContent({ overview }: { overview: WorkspaceOverview }) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">{overview.role}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{overview.name}</h1>
        <p className="mt-1 text-sm text-slate-500">/{overview.slug}</p>
      </div>

      <WorkspaceNav workspaceId={overview.workspaceId} />

      <OverviewMetricsCards
        jobCounts={overview.jobCounts}
        totalCandidates={overview.totalCandidates}
        candidateCounts={overview.candidateCounts}
      />

      <div>
        <h2 className="text-sm font-semibold text-slate-950">Active jobs</h2>
        <div className="mt-3">
          <JobWorkloadList workspaceId={overview.workspaceId} workload={overview.workload} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-950">Recent activity</h2>
        <div className="mt-3">
          <RecentActivityFeed workspaceId={overview.workspaceId} activity={overview.recentActivity} />
        </div>
      </div>
    </div>
  );
}
