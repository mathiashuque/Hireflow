"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ApiError, ApiUnavailableError } from "@/lib/api/client";
import { getWorkspace, type WorkspaceDetail } from "@/lib/api/workspaces";
import { createJob, listJobs, type JobOpening, type JobStatus } from "@/lib/api/jobs";
import { WorkspaceNav } from "@/components/WorkspaceNav";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import { JobDetailsForm } from "@/components/JobDetailsForm";

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
      </section>
    </main>
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
    return <p className="text-sm text-slate-500">Loading jobs…</p>;
  }

  if (state.status === "not-found") {
    return (
      <div className="max-w-md">
        <h1 className="text-xl font-semibold text-slate-950">Workspace unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">
          This workspace doesn&apos;t exist, or you don&apos;t have access to it.
        </p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
          Back to your workspaces
        </Link>
      </div>
    );
  }

  if (state.status === "unavailable" || state.status === "error") {
    return (
      <div className="flex max-w-md flex-col items-start gap-3">
        <p className="text-sm text-slate-600">
          {state.status === "unavailable"
            ? "Hireflow can't reach the API right now. Check that the backend is running and try again."
            : "Something went wrong loading jobs."}
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

  const { workspace, jobs } = state;
  const canManage = workspace.role === "Owner" || workspace.role === "Recruiter";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">{workspace.role}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{workspace.name}</h1>
      </div>

      <WorkspaceNav workspaceId={workspace.id} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="group" aria-label="Filter jobs by status" className="flex gap-1">
          {FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onFilterChange(option)}
              aria-pressed={filter === option}
              className={`rounded-full px-3 py-1 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
                filter === option ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        {canManage && !showCreateForm ? (
          <button
            type="button"
            onClick={onCreateClick}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            New job
          </button>
        ) : null}
      </div>

      {showCreateForm ? (
        <CreateJobPanel workspaceId={workspace.id} onCreated={onCreated} onCancel={onCreateCancel} />
      ) : null}

      {jobs.length === 0 ? (
        <p className="text-sm text-slate-500">
          {filter === "All" ? "No job openings yet." : `No ${filter.toLowerCase()} jobs.`}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {jobs.map((job) => (
            <li key={job.id}>
              <Link
                href={`/workspaces/${workspace.id}/jobs/${job.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500"
              >
                <div>
                  <p className="text-sm font-medium text-slate-950">{job.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Updated {new Date(job.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <JobStatusBadge status={job.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
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
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-950">New job</h2>
      <p className="mt-1 text-sm text-slate-500">New jobs start as Draft.</p>
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
    </div>
  );
}
