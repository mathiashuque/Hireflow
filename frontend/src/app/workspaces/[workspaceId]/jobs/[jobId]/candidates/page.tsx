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
  isNoOpStageConflict,
  listCandidates,
  moveCandidateStage,
  type Candidate,
  type CandidateStage,
} from "@/lib/api/candidates";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import { CandidateDetailsForm } from "@/components/CandidateDetailsForm";
import { CandidateStageMoveControl } from "@/components/CandidateStageMoveControl";

type PageState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; workspace: WorkspaceDetail; job: JobOpening; candidates: Candidate[] };

export default function JobCandidatesPage(props: PageProps<"/workspaces/[workspaceId]/jobs/[jobId]/candidates">) {
  const { workspaceId, jobId } = use(props.params);
  const { status: authStatus, user } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [showAddForm, setShowAddForm] = useState(false);
  const [moveNotice, setMoveNotice] = useState<string | null>(null);

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

      const candidates = await listCandidates(workspaceId, jobId);
      if (!candidates) {
        return { status: "not-found" };
      }

      return { status: "ready", workspace, job, candidates };
    } catch (error) {
      return { status: error instanceof ApiUnavailableError ? "unavailable" : "error" };
    }
  }, [workspaceId, jobId]);

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

  async function handleMove(candidate: Candidate, target: CandidateStage) {
    setMoveNotice(null);
    try {
      await moveCandidateStage(workspaceId, candidate.id, { stage: target, version: candidate.version });
      refresh();
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        throw error;
      }
      if (isNoOpStageConflict(error)) {
        throw new Error("The candidate is already in this stage.");
      }
      if (error instanceof ApiError && error.status === 409) {
        setMoveNotice(`${candidate.name} was changed by someone else. The board has been refreshed.`);
        refresh();
        return;
      }
      if (error instanceof ApiError && error.status === 403) {
        throw new Error("You don't have permission to move this candidate.");
      }
      throw new Error("Something went wrong moving this candidate. Please try again.");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 sm:px-10">
      <nav className="flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-950">
          Hireflow
        </Link>
        <Link href={`/workspaces/${workspaceId}/jobs/${jobId}`} className="text-sm font-medium text-indigo-600 hover:underline">
          Back to job
        </Link>
      </nav>

      <section className="flex-1 py-12">
        <BoardContent
          state={state}
          showAddForm={showAddForm}
          moveNotice={moveNotice}
          onRetry={retry}
          onAddClick={() => setShowAddForm(true)}
          onAddCancel={() => setShowAddForm(false)}
          onAdded={() => {
            setShowAddForm(false);
            refresh();
          }}
          onMove={handleMove}
        />
      </section>
    </main>
  );
}

function BoardContent({
  state,
  showAddForm,
  moveNotice,
  onRetry,
  onAddClick,
  onAddCancel,
  onAdded,
  onMove,
}: {
  state: PageState;
  showAddForm: boolean;
  moveNotice: string | null;
  onRetry: () => void;
  onAddClick: () => void;
  onAddCancel: () => void;
  onAdded: () => void;
  onMove: (candidate: Candidate, target: CandidateStage) => Promise<void>;
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

  const columns = CANDIDATE_STAGES.map((stage) => ({
    stage,
    candidates: candidates.filter((candidate) => candidate.stage === stage),
  }));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <JobStatusBadge status={job.status} />
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{job.title}</h1>
          <p className="mt-1 text-sm text-slate-500">Hiring board for this job</p>
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

      {moveNotice ? (
        <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {moveNotice}
        </p>
      ) : null}

      {canManage && !canAdd ? (
        <p className="text-sm text-amber-800">
          {job.status === "Draft"
            ? "This job is still a Draft. Open it before adding candidates."
            : "This job is Closed. Reopen it to add new candidates; existing candidates can still be moved and edited."}
        </p>
      ) : null}

      {showAddForm && canAdd ? (
        <AddCandidatePanel workspaceId={workspace.id} jobId={job.id} onAdded={onAdded} onCancel={onAddCancel} />
      ) : null}

      <div role="group" aria-label="Hiring pipeline board" className="flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-5 sm:overflow-visible">
        {columns.map(({ stage, candidates: stageCandidates }) => (
          <div
            key={stage}
            aria-label={`${stage}, ${stageCandidates.length} candidate${stageCandidates.length === 1 ? "" : "s"}`}
            className="flex w-64 shrink-0 flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:w-auto"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-950">{stage}</h2>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                {stageCandidates.length}
              </span>
            </div>

            {stageCandidates.length === 0 ? (
              <p className="text-xs text-slate-400">No candidates.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {stageCandidates.map((candidate) => (
                  <li key={candidate.id} className="rounded-lg border border-slate-200 bg-white p-3">
                    <Link
                      href={`/workspaces/${workspace.id}/candidates/${candidate.id}`}
                      className="text-sm font-medium text-slate-950 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                    >
                      {candidate.name}
                    </Link>
                    {canManage ? (
                      <div className="mt-2">
                        <CandidateStageMoveControl
                          currentStage={candidate.stage}
                          labelPrefix={`Move ${candidate.name} to`}
                          onMove={(target) => onMove(candidate, target)}
                        />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

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
