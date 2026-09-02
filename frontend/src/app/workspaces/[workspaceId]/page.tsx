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
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { Reveal } from "@/components/motion/Reveal";

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
      <AppShell>
        <SkeletonBlock label="Loading your account…" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      {state.status === "loading" && <SkeletonBlock label="Loading overview…" />}

      {state.status === "not-found" && (
        <div className="max-w-md">
          <h1 className="text-xl font-semibold text-text-primary">Workspace unavailable</h1>
          <p className="mt-2 text-sm text-text-secondary">
            This workspace doesn&apos;t exist, or you don&apos;t have access to it.
          </p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-brand hover:underline">
            Back to your workspaces
          </Link>
        </div>
      )}

      {(state.status === "unavailable" || state.status === "error") && (
        <div className="flex max-w-md flex-col items-start gap-3">
          <p className="text-sm text-text-secondary">
            {state.status === "unavailable"
              ? "Hireflow can't reach the API right now. Check that the backend is running and try again."
              : "Something went wrong loading this workspace."}
          </p>
          <Button variant="primary" size="sm" onClick={retry}>
            Try again
          </Button>
        </div>
      )}

      {state.status === "ready" && <WorkspaceOverviewContent overview={state.overview} />}
    </AppShell>
  );
}

function WorkspaceOverviewContent({ overview }: { overview: WorkspaceOverview }) {
  return (
    <Reveal className="flex flex-col gap-8">
      <PageHeader eyebrow={overview.role} title={overview.name} description={`/${overview.slug}`} />

      <WorkspaceNav workspaceId={overview.workspaceId} />

      <OverviewMetricsCards
        jobCounts={overview.jobCounts}
        totalCandidates={overview.totalCandidates}
        candidateCounts={overview.candidateCounts}
      />

      <div>
        <h2 className="text-sm font-semibold text-text-primary">Active jobs</h2>
        <div className="mt-3">
          <JobWorkloadList workspaceId={overview.workspaceId} workload={overview.workload} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-text-primary">Recent activity</h2>
        <div className="mt-3">
          <RecentActivityFeed workspaceId={overview.workspaceId} activity={overview.recentActivity} />
        </div>
      </div>
    </Reveal>
  );
}
