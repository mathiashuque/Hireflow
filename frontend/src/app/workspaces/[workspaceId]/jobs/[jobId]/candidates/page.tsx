"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ApiError, ApiUnavailableError } from "@/lib/api/client";
import { getJob, type JobOpening } from "@/lib/api/jobs";
import { getWorkspace, type WorkspaceDetail } from "@/lib/api/workspaces";
import {
  CANDIDATE_STAGES,
  createCandidate,
  isDuplicateEmailConflict,
  isJobNotOpenConflict,
  listCandidates,
  type Candidate,
  type CandidateStage,
} from "@/lib/api/candidates";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import { CandidateStageBadge } from "@/components/CandidateStageBadge";
import { CandidateDetailsForm } from "@/components/CandidateDetailsForm";

type StageFilter = CandidateStage | "All";

type PageState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; workspace: WorkspaceDetail; job: JobOpening; candidates: Candidate[] };

const FILTERS: StageFilter[] = ["All", ...CANDIDATE_STAGES];

export default function JobCandidatesPage(props: PageProps<"/workspaces/[workspaceId]/jobs/[jobId]/candidates">) {
  const { workspaceId, jobId } = use(props.params);
  const { status: authStatus, user } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [filter, setFilter] = useState<StageFilter>("All");
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchState = useCallback(async (): Promise<PageState> => {
    try {
      const workspace = await getWorkspace(workspaceId);
      if (!workspace) {
        return { status: "not-found" };
      }

      const job = await getJob(workspaceId, jobId);
      if (!job) {
        return { status: "not-found" };
      }

      const candidates = await listCandidates(workspaceId, jobId, filter === "All" ? undefined : filter);
      if (!candidates) {
        return { status: "not-found" };
      }

      return { status: "ready", workspace, job, candidates };
    } catch (error) {
      return { status: error instanceof ApiUnavailableError ? "unavailable" : "error" };
    }
  }, [workspaceId, jobId, filter]);

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
        <Link href={`/workspaces/${workspaceId}/jobs/${jobId}`} className="text-sm font-medium text-indigo-600 hover:underline">
          Back to job
        </Link>
      </nav>

      <section className="flex-1 py-12">
        <CandidatesContent
          state={state}
          filter={filter}
          showAddForm={showAddForm}
          onFilterChange={setFilter}
          onRetry={retry}
          onAddClick={() => setShowAddForm(true)}
          onAddCancel={() => setShowAddForm(false)}
          onAdded={() => {
            setShowAddForm(false);
            refresh();
          }}
        />
      </section>
    </main>
  );
}

function CandidatesContent({
  state,
  filter,
  showAddForm,
  onFilterChange,
  onRetry,
  onAddClick,
  onAddCancel,
  onAdded,
}: {
  state: PageState;
  filter: StageFilter;
  showAddForm: boolean;
  onFilterChange: (filter: StageFilter) => void;
  onRetry: () => void;
  onAddClick: () => void;
  onAddCancel: () => void;
  onAdded: () => void;
}) {
  if (state.status === "loading") {
    return <p className="text-sm text-slate-500">Loading candidates…</p>;
  }

  if (state.status === "not-found") {
    return (
      <div className="max-w-md">
        <h1 className="text-xl font-semibold text-slate-950">Job unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">
          This job doesn&apos;t exist, or you don&apos;t have access to it.
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
            : "Something went wrong loading candidates."}
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

  const { workspace, job, candidates } = state;
  const canManage = workspace.role === "Owner" || workspace.role === "Recruiter";
  const canAdd = canManage && job.status === "Open";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <JobStatusBadge status={job.status} />
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{job.title}</h1>
        <p className="mt-1 text-sm text-slate-500">Candidates for this job</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="group" aria-label="Filter candidates by stage" className="flex flex-wrap gap-1">
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

        {canManage && !showAddForm ? (
          <button
            type="button"
            disabled={!canAdd}
            onClick={onAddClick}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add candidate
          </button>
        ) : null}
      </div>

      {canManage && !canAdd ? (
        <p className="text-sm text-amber-800">
          {job.status === "Draft"
            ? "This job is still a Draft. Open it before adding candidates."
            : "This job is Closed. Reopen it to add new candidates; existing candidates can still be edited."}
        </p>
      ) : null}

      {showAddForm && canAdd ? (
        <AddCandidatePanel workspaceId={workspace.id} jobId={job.id} onAdded={onAdded} onCancel={onAddCancel} />
      ) : null}

      {candidates.length === 0 ? (
        <p className="text-sm text-slate-500">
          {filter === "All" ? "No candidates yet." : `No candidates in ${filter}.`}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {candidates.map((candidate) => (
            <li key={candidate.id}>
              <Link
                href={`/workspaces/${workspace.id}/candidates/${candidate.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500"
              >
                <div>
                  <p className="text-sm font-medium text-slate-950">{candidate.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{candidate.email}</p>
                </div>
                <CandidateStageBadge stage={candidate.stage} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!canManage ? <p className="text-xs text-slate-400">You have read-only access to this job&apos;s candidates.</p> : null}
    </div>
  );
}

function AddCandidatePanel({
  workspaceId,
  jobId,
  onAdded,
  onCancel,
}: {
  workspaceId: string;
  jobId: string;
  onAdded: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-950">Add candidate</h2>
      <p className="mt-1 text-sm text-slate-500">New candidates start in the Applied stage.</p>
      <div className="mt-4">
        <CandidateDetailsForm
          submitLabel="Add candidate"
          submittingLabel="Adding…"
          onCancel={onCancel}
          onSubmit={async ({ name, email }) => {
            try {
              await createCandidate(workspaceId, jobId, { name, email });
              onAdded();
            } catch (error) {
              if (error instanceof ApiUnavailableError) {
                throw error;
              }
              if (isJobNotOpenConflict(error)) {
                throw new Error("This job is no longer open. Refresh the page to see its current status.");
              }
              if (isDuplicateEmailConflict(error)) {
                throw new Error("A candidate with this email already exists for this job.");
              }
              if (error instanceof ApiError) {
                throw new Error(error.fieldErrors.Name?.[0] ?? error.message);
              }
              throw new Error("Something went wrong. Please try again.");
            }
          }}
        />
      </div>
    </div>
  );
}
