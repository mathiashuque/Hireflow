"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ApiError, ApiUnavailableError } from "@/lib/api/client";
import { getWorkspace, type WorkspaceDetail } from "@/lib/api/workspaces";
import { createJob, listJobs, type JobOpening, type JobStatus } from "@/lib/api/jobs";
import { WorkspaceNav } from "@/components/WorkspaceNav";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import { JobDetailsForm } from "@/components/JobDetailsForm";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { Reveal } from "@/components/motion/Reveal";
import { collapsePanel, fadeIn, staggerContainer, staggerItem } from "@/lib/motion";

type StatusFilter = JobStatus | "All";

type PageState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; workspace: WorkspaceDetail; jobs: JobOpening[] };

const FILTERS: StatusFilter[] = ["All", "Draft", "Open", "Closed"];

export default function WorkspaceJobsPage(props: PageProps<"/workspaces/[workspaceId]/jobs">) {
  const { workspaceId } = use(props.params);
  const { status: authStatus, user } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [filter, setFilter] = useState<StatusFilter>("All");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const fetchState = useCallback(async (): Promise<PageState> => {
    try {
      const workspace = await getWorkspace(workspaceId);
      if (!workspace) {
        return { status: "not-found" };
      }

      const jobs = await listJobs(workspaceId, filter === "All" ? undefined : filter);
      if (!jobs) {
        return { status: "not-found" };
      }

      return { status: "ready", workspace, jobs };
    } catch (error) {
      return { status: error instanceof ApiUnavailableError ? "unavailable" : "error" };
    }
  }, [workspaceId, filter]);

  const refresh = useCallback(() => {
    void fetchState().then(setState);
  }, [fetchState]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    refresh();
  }, [refresh]);

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
      <JobsContent
        state={state}
        filter={filter}
        showCreateForm={showCreateForm}
        onFilterChange={setFilter}
        onRetry={retry}
        onCreateClick={() => setShowCreateForm(true)}
        onCreateCancel={() => setShowCreateForm(false)}
        onCreated={(job) => {
          setShowCreateForm(false);
          router.push(`/workspaces/${job.workspaceId}/jobs/${job.id}`);
        }}
      />
    </AppShell>
  );
}

function JobsContent({
  state,
  filter,
  showCreateForm,
  onFilterChange,
  onRetry,
  onCreateClick,
  onCreateCancel,
  onCreated,
}: {
  state: PageState;
  filter: StatusFilter;
  showCreateForm: boolean;
  onFilterChange: (filter: StatusFilter) => void;
  onRetry: () => void;
  onCreateClick: () => void;
  onCreateCancel: () => void;
  onCreated: (job: JobOpening) => void;
}) {
  if (state.status === "loading") {
    return <SkeletonBlock label="Loading jobs…" />;
  }

  if (state.status === "not-found") {
    return (
      <div className="max-w-md">
        <h1 className="text-xl font-semibold text-text-primary">Workspace unavailable</h1>
        <p className="mt-2 text-sm text-text-secondary">
          This workspace doesn&apos;t exist, or you don&apos;t have access to it.
        </p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-brand hover:underline">
          Back to your workspaces
        </Link>
      </div>
    );
  }

  if (state.status === "unavailable" || state.status === "error") {
    return (
      <div className="flex max-w-md flex-col items-start gap-3">
        <p className="text-sm text-text-secondary">
          {state.status === "unavailable"
            ? "Hireflow can't reach the API right now. Check that the backend is running and try again."
            : "Something went wrong loading jobs."}
        </p>
        <Button variant="primary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  const { workspace, jobs } = state;
  const canManage = workspace.role === "Owner" || workspace.role === "Recruiter";

  return (
    <Reveal className="flex flex-col gap-8">
      <PageHeader eyebrow={workspace.role} title={workspace.name} />

      <WorkspaceNav workspaceId={workspace.id} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="group" aria-label="Filter jobs by status" className="flex gap-1 overflow-x-auto">
          {FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onFilterChange(option)}
              aria-pressed={filter === option}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                filter === option ? "bg-slate-900 text-white" : "bg-surface-muted text-text-secondary hover:bg-border"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        {canManage && !showCreateForm ? (
          <Button variant="primary" size="sm" onClick={onCreateClick}>
            New job
          </Button>
        ) : null}
      </div>

      <AnimatePresence initial={false}>
        {showCreateForm ? (
          <motion.div key="create-job" variants={collapsePanel} initial="hidden" animate="show" exit="exit">
            <CreateJobPanel workspaceId={workspace.id} onCreated={onCreated} onCancel={onCreateCancel} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div key={filter + jobs.length} variants={fadeIn} initial="hidden" animate="show" exit="exit">
          {jobs.length === 0 ? (
            <EmptyState
              title={filter === "All" ? "No job openings yet" : `No ${filter.toLowerCase()} jobs`}
              description={
                canManage
                  ? "Create a job opening to start building a candidate pipeline."
                  : undefined
              }
            />
          ) : (
            <motion.ul
              initial="hidden"
              animate="show"
              variants={staggerContainer}
              className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface"
            >
              {jobs.map((job) => (
                <motion.li key={job.id} variants={staggerItem}>
                  <Link
                    href={`/workspaces/${workspace.id}/jobs/${job.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
                  >
                    <div>
                      <p className="text-sm font-medium text-text-primary">{job.title}</p>
                      <p className="mt-0.5 text-xs text-text-muted">
                        Updated {new Date(job.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <JobStatusBadge status={job.status} />
                  </Link>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </motion.div>
      </AnimatePresence>
    </Reveal>
  );
}

function CreateJobPanel({
  workspaceId,
  onCreated,
  onCancel,
}: {
  workspaceId: string;
  onCreated: (job: JobOpening) => void;
  onCancel: () => void;
}) {
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-text-primary">New job</h2>
      <p className="mt-1 text-sm text-text-muted">New jobs start as Draft.</p>
      <div className="mt-4">
        <JobDetailsForm
          submitLabel="Create job"
          submittingLabel="Creating…"
          onCancel={onCancel}
          onSubmit={async ({ title, description }) => {
            try {
              const job = await createJob(workspaceId, { title, description: description || undefined });
              onCreated(job);
            } catch (error) {
              if (error instanceof ApiUnavailableError) {
                throw error;
              }
              if (error instanceof ApiError) {
                throw new Error(error.fieldErrors.Title?.[0] ?? error.message);
              }
              throw new Error("Something went wrong. Please try again.");
            }
          }}
        />
      </div>
    </Card>
  );
}
