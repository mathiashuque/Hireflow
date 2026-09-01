"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ApiError, ApiUnavailableError } from "@/lib/api/client";
import { getWorkspace } from "@/lib/api/workspaces";
import { changeJobStatus, getJob, isConcurrencyConflict, updateJob, type JobOpening, type JobStatus } from "@/lib/api/jobs";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import { JobDetailsForm } from "@/components/JobDetailsForm";

type PageState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; job: JobOpening; canManage: boolean };

export default function JobDetailPage(props: PageProps<"/workspaces/[workspaceId]/jobs/[jobId]">) {
  const { workspaceId, jobId } = use(props.params);
  const { status: authStatus, user } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [isEditing, setIsEditing] = useState(false);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

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

      // This only decides which controls the UI shows; the backend independently
      // enforces every mutation regardless of what the client believes the role is.
      const canManage = workspace.role === "Owner" || workspace.role === "Recruiter";

      return { status: "ready", job, canManage };
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

  async function handleSaveEdit(input: { title: string; description: string }) {
    if (state.status !== "ready") {
      return;
    }

    setConflictMessage(null);
    try {
      const updated = await updateJob(workspaceId, jobId, {
        title: input.title,
        description: input.description || undefined,
        version: state.job.version,
      });
      setState({ status: "ready", job: updated, canManage: state.canManage });
      setIsEditing(false);
    } catch (error) {
      if (isConcurrencyConflict(error)) {
        setConflictMessage("This job was changed by someone else. The latest version is now shown below — please redo your edit.");
        refresh();
        return;
      }
      if (error instanceof ApiUnavailableError) {
        throw error;
      }
      if (error instanceof ApiError) {
        throw new Error(error.fieldErrors.Title?.[0] ?? error.message);
      }
      throw new Error("Something went wrong. Please try again.");
    }
  }

  async function handleStatusChange(target: "Open" | "Closed") {
    if (state.status !== "ready") {
      return;
    }

    if (target === "Closed" && !window.confirm("Close this job opening? You can reopen it later.")) {
      return;
    }

    setStatusError(null);
    setConflictMessage(null);
    setIsChangingStatus(true);
    try {
      const updated = await changeJobStatus(workspaceId, jobId, target, state.job.version);
      setState({ status: "ready", job: updated, canManage: state.canManage });
    } catch (error) {
      if (isConcurrencyConflict(error)) {
        setConflictMessage("This job was changed by someone else. The latest version is now shown below.");
        refresh();
      } else if (error instanceof ApiUnavailableError) {
        setStatusError(error.message);
      } else if (error instanceof ApiError) {
        setStatusError(error.message);
      } else {
        setStatusError("Something went wrong. Please try again.");
      }
    } finally {
      setIsChangingStatus(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-8 sm:px-10">
      <nav className="flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-950">
          Hireflow
        </Link>
        <Link href={`/workspaces/${workspaceId}/jobs`} className="text-sm font-medium text-indigo-600 hover:underline">
          Back to jobs
        </Link>
      </nav>

      <section className="flex-1 py-12">
        {state.status === "loading" && <p className="text-sm text-slate-500">Loading job…</p>}

        {state.status === "not-found" && (
          <div className="max-w-md">
            <h1 className="text-xl font-semibold text-slate-950">Job unavailable</h1>
            <p className="mt-2 text-sm text-slate-600">
              This job doesn&apos;t exist, or you don&apos;t have access to it.
            </p>
            <Link href={`/workspaces/${workspaceId}/jobs`} className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
              Back to jobs
            </Link>
          </div>
        )}

        {(state.status === "unavailable" || state.status === "error") && (
          <div className="flex max-w-md flex-col items-start gap-3">
            <p className="text-sm text-slate-600">
              {state.status === "unavailable"
                ? "Hireflow can't reach the API right now. Check that the backend is running and try again."
                : "Something went wrong loading this job."}
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

        {state.status === "ready" && (
          <JobDetail
            job={state.job}
            canManage={state.canManage}
            isEditing={isEditing}
            conflictMessage={conflictMessage}
            statusError={statusError}
            isChangingStatus={isChangingStatus}
            onEdit={() => setIsEditing(true)}
            onCancelEdit={() => setIsEditing(false)}
            onSaveEdit={handleSaveEdit}
            onStatusChange={handleStatusChange}
          />
        )}
      </section>
    </main>
  );
}

function JobDetail({
  job,
  canManage,
  isEditing,
  conflictMessage,
  statusError,
  isChangingStatus,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onStatusChange,
}: {
  job: JobOpening;
  canManage: boolean;
  isEditing: boolean;
  conflictMessage: string | null;
  statusError: string | null;
  isChangingStatus: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (input: { title: string; description: string }) => Promise<void>;
  onStatusChange: (target: "Open" | "Closed") => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      {conflictMessage ? (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {conflictMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <JobStatusBadge status={job.status} />
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{job.title}</h1>
          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <div>
              <dt className="inline font-medium">Created</dt> <dd className="inline">{new Date(job.createdAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Updated</dt> <dd className="inline">{new Date(job.updatedAt).toLocaleString()}</dd>
            </div>
            {job.closedAt ? (
              <div>
                <dt className="inline font-medium">Closed</dt> <dd className="inline">{new Date(job.closedAt).toLocaleString()}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/workspaces/${job.workspaceId}/jobs/${job.id}/candidates`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            Candidates
          </Link>
          {canManage && !isEditing ? (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              >
                Edit
              </button>
              <StatusActions status={job.status} disabled={isChangingStatus} onChange={onStatusChange} />
            </>
          ) : null}
        </div>
      </div>

      {statusError ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {statusError}
        </p>
      ) : null}

      {isEditing ? (
        <JobDetailsForm
          initialTitle={job.title}
          initialDescription={job.description ?? ""}
          submitLabel="Save changes"
          submittingLabel="Saving…"
          onCancel={onCancelEdit}
          onSubmit={onSaveEdit}
        />
      ) : job.description ? (
        <p className="max-w-2xl whitespace-pre-wrap text-sm text-slate-700">{job.description}</p>
      ) : (
        <p className="text-sm text-slate-400">No description.</p>
      )}

      {!canManage ? <p className="text-xs text-slate-400">You have read-only access to this job.</p> : null}
    </div>
  );
}

function StatusActions({
  status,
  disabled,
  onChange,
}: {
  status: JobStatus;
  disabled: boolean;
  onChange: (target: "Open" | "Closed") => void;
}) {
  if (status === "Draft") {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("Open")}
        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Open
      </button>
    );
  }

  if (status === "Open") {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("Closed")}
        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Close
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange("Open")}
      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
    >
      Reopen
    </button>
  );
}
