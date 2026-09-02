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
import { useI18n } from "@/i18n/LocaleProvider";
import { jobStatusLabel, roleLabel } from "@/i18n/enumLabels";
import type { Dictionary } from "@/i18n/dictionaries";

type StatusFilter = JobStatus | "All";

type PageState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; workspace: WorkspaceDetail; jobs: JobOpening[] };

const FILTERS: StatusFilter[] = ["All", "Draft", "Open", "Closed"];

export default function WorkspaceJobsPage(props: PageProps<"/[lang]/workspaces/[workspaceId]/jobs">) {
  const { workspaceId } = use(props.params);
  const { status: authStatus, user } = useAuth();
  const router = useRouter();
  const { dict, href } = useI18n();
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
      router.replace(href("/login"));
    }
  }, [authStatus, router, href]);

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
      <AppShell maxWidth="xl">
        <SkeletonBlock label={dict.nav.loadingAccount} />
      </AppShell>
    );
  }

  return (
    <AppShell maxWidth="xl">
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
          router.push(href(`/workspaces/${job.workspaceId}/jobs/${job.id}`));
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
  const { dict, href, formatDate } = useI18n();

  if (state.status === "loading") {
    return <SkeletonBlock label={dict.jobs.loadingJobs} />;
  }

  if (state.status === "not-found") {
    return (
      <div className="max-w-md">
        <h1 className="text-xl font-semibold text-text-primary">{dict.workspaces.unavailableTitle}</h1>
        <p className="mt-2 text-sm text-text-secondary">{dict.workspaces.unavailableDescription}</p>
        <Link href={href("/dashboard")} className="mt-4 inline-block text-sm font-medium text-brand hover:underline">
          {dict.workspaces.backToWorkspaces}
        </Link>
      </div>
    );
  }

  if (state.status === "unavailable" || state.status === "error") {
    return (
      <div className="flex max-w-md flex-col items-start gap-3">
        <p className="text-sm text-text-secondary">
          {state.status === "unavailable" ? dict.common.apiUnavailable : dict.jobs.loadFailed}
        </p>
        <Button variant="primary" size="sm" onClick={onRetry}>
          {dict.common.tryAgain}
        </Button>
      </div>
    );
  }

  const { workspace, jobs } = state;
  const canManage = workspace.role === "Owner" || workspace.role === "Recruiter";

  return (
    <Reveal className="flex flex-col gap-8">
      <PageHeader eyebrow={roleLabel(dict, workspace.role)} title={workspace.name} />

      <WorkspaceNav workspaceId={workspace.id} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="group" aria-label={dict.jobs.filterGroupLabel} className="flex gap-1 overflow-x-auto">
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
              {option === "All" ? dict.jobs.filterAll : jobStatusLabel(dict, option)}
            </button>
          ))}
        </div>

        {canManage && !showCreateForm ? (
          <Button variant="primary" size="sm" onClick={onCreateClick}>
            {dict.jobs.newJob}
          </Button>
        ) : null}
      </div>

      <AnimatePresence initial={false}>
        {showCreateForm ? (
          <motion.div key="create-job" variants={collapsePanel} initial="hidden" animate="show" exit="exit">
            <CreateJobPanel workspaceId={workspace.id} onCreated={onCreated} onCancel={onCreateCancel} dict={dict} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div key={filter + jobs.length} variants={fadeIn} initial="hidden" animate="show" exit="exit">
          {jobs.length === 0 ? (
            <EmptyState
              title={filter === "All" ? dict.jobs.emptyAllTitle : dict.jobs.emptyFilteredTitle(jobStatusLabel(dict, filter).toLowerCase())}
              description={canManage ? dict.jobs.emptyDescriptionManage : undefined}
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
                    href={href(`/workspaces/${workspace.id}/jobs/${job.id}`)}
                    className="flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
                  >
                    <div>
                      <p className="text-sm font-medium text-text-primary">{job.title}</p>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {dict.jobs.updated} {formatDate(job.updatedAt)}
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
  dict,
}: {
  workspaceId: string;
  onCreated: (job: JobOpening) => void;
  onCancel: () => void;
  dict: Dictionary;
}) {
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-text-primary">{dict.jobs.createJobHeading}</h2>
      <p className="mt-1 text-sm text-text-muted">{dict.jobs.createJobHint}</p>
      <div className="mt-4">
        <JobDetailsForm
          submitLabel={dict.jobs.createJobSubmit}
          submittingLabel={dict.jobs.createJobSubmitting}
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
                throw new Error(error.fieldErrors.Title?.[0] ?? dict.errors.validation_error);
              }
              throw new Error(dict.common.genericError);
            }
          }}
        />
      </div>
    </Card>
  );
}
