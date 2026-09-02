"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ApiUnavailableError } from "@/lib/api/client";
import { getWorkspaceOverview, type WorkspaceOverview } from "@/lib/api/overview";
import { WorkspaceNav } from "@/components/WorkspaceNav";
import { WorkspaceMonogram } from "@/components/WorkspaceMonogram";
import { OverviewMetricsCards } from "@/components/OverviewMetricsCards";
import { JobWorkloadList } from "@/components/JobWorkloadList";
import { RecentActivityFeed } from "@/components/RecentActivityFeed";
import { AppShell } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonBlock } from "@/components/ui/Skeleton";
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
      <AppShell maxWidth="xl">
        <SkeletonBlock label="Loading your account…" />
      </AppShell>
    );
  }

  return (
    <AppShell maxWidth="xl">
      {state.status === "loading" && <OverviewSkeleton />}

      {state.status === "not-found" && (
        <FailurePanel
          title="Workspace unavailable"
          description="This workspace doesn't exist, or you don't have access to it."
          action={
            <Link href="/dashboard" className="text-sm font-medium text-brand hover:underline">
              Back to your workspaces
            </Link>
          }
        />
      )}

      {(state.status === "unavailable" || state.status === "error") && (
        <FailurePanel
          title={state.status === "unavailable" ? "Hireflow is unreachable" : "Something went wrong"}
          description={
            state.status === "unavailable"
              ? "Hireflow can't reach the API right now. Check that the backend is running and try again."
              : "Something went wrong loading this workspace."
          }
          action={
            <Button variant="primary" size="sm" onClick={retry}>
              Try again
            </Button>
          }
        />
      )}

      {state.status === "ready" && <WorkspaceOverviewContent overview={state.overview} />}
    </AppShell>
  );
}

function FailurePanel({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <Card className="max-w-md p-6 text-center">
        <h1 className="text-lg font-semibold text-text-primary">{title}</h1>
        <p className="mt-2 text-sm text-text-secondary">{description}</p>
        <div className="mt-4 flex justify-center">{action}</div>
      </Card>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-text-muted">Loading workspace overview…</p>
      <div aria-hidden="true" className="flex flex-col gap-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-9 w-full max-w-sm" />
        <Skeleton className="h-44 w-full rounded-lg" />
        <div className="grid gap-6 lg:grid-cols-12">
          <Skeleton className="h-72 w-full rounded-lg lg:col-span-7" />
          <Skeleton className="h-72 w-full rounded-lg lg:col-span-5" />
        </div>
      </div>
    </div>
  );
}

function WorkspaceOverviewContent({ overview }: { overview: WorkspaceOverview }) {
  return (
    <Reveal className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <WorkspaceMonogram name={overview.name} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">{overview.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-strong">
                {overview.role}
              </span>
              <span className="text-sm text-text-muted">/{overview.slug}</span>
            </div>
          </div>
        </div>

        <Link
          href={`/workspaces/${overview.workspaceId}/jobs`}
          className="inline-flex items-center justify-center rounded-lg border border-border-strong px-3.5 py-1.5 text-sm font-medium text-text-secondary transition hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          View jobs
        </Link>
      </div>

      <WorkspaceNav workspaceId={overview.workspaceId} />

      <OverviewMetricsCards
        jobCounts={overview.jobCounts}
        totalCandidates={overview.totalCandidates}
        candidateCounts={overview.candidateCounts}
      />

      <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
        <section aria-labelledby="active-jobs-heading" className="lg:col-span-7">
          <h2 id="active-jobs-heading" className="text-sm font-semibold text-text-primary">
            Active jobs
          </h2>
          <div className="mt-3">
            <JobWorkloadList workspaceId={overview.workspaceId} workload={overview.workload} />
          </div>
        </section>

        <section aria-labelledby="recent-activity-heading" className="lg:col-span-5">
          <h2 id="recent-activity-heading" className="text-sm font-semibold text-text-primary">
            Recent activity
          </h2>
          <div className="mt-3">
            <RecentActivityFeed workspaceId={overview.workspaceId} activity={overview.recentActivity} />
          </div>
        </section>
      </div>
    </Reveal>
  );
}
