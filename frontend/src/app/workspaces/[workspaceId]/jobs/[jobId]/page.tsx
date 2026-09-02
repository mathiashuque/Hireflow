"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ApiError, ApiUnavailableError } from "@/lib/api/client";
import { getWorkspace } from "@/lib/api/workspaces";
import {
  changeJobStatus,
  getJob,
  isConcurrencyConflict,
  isInvalidTransitionConflict,
  updateJob,
  type JobOpening,
  type JobStatus,
} from "@/lib/api/jobs";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import { JobDetailsForm } from "@/components/JobDetailsForm";
import { AppShell } from "@/components/shell/AppShell";
import { Breadcrumbs } from "@/components/shell/Breadcrumbs";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { AnimatedStatus, StatusBanner } from "@/components/ui/StatusBanner";
import { Reveal } from "@/components/motion/Reveal";

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
      <AppShell maxWidth="xl">
        <SkeletonBlock label="Loading your account…" />
      </AppShell>
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
      } else if (error instanceof ApiError && isInvalidTransitionConflict(error)) {
        setStatusError(error.message);
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
    <AppShell maxWidth="xl">
      <Breadcrumbs
        items={[
          { label: "Workspace", href: `/workspaces/${workspaceId}` },
          { label: "Jobs", href: `/workspaces/${workspaceId}/jobs` },
          { label: state.status === "ready" ? state.job.title : "Job" },
        ]}
      />

      <div className="mt-6">
        {state.status === "loading" && <SkeletonBlock label="Loading job…" />}

        {state.status === "not-found" && (
          <div className="max-w-md">
            <h1 className="text-xl font-semibold text-text-primary">Job unavailable</h1>
            <p className="mt-2 text-sm text-text-secondary">
              This job doesn&apos;t exist, or you don&apos;t have access to it.
            </p>
            <Link href={`/workspaces/${workspaceId}/jobs`} className="mt-4 inline-block text-sm font-medium text-brand hover:underline">
              Back to jobs
            </Link>
          </div>
        )}

        {(state.status === "unavailable" || state.status === "error") && (
          <div className="flex max-w-md flex-col items-start gap-3">
            <p className="text-sm text-text-secondary">
              {state.status === "unavailable"
                ? "Hireflow can't reach the API right now. Check that the backend is running and try again."
                : "Something went wrong loading this job."}
            </p>
            <Button variant="primary" size="sm" onClick={retry}>
              Try again
            </Button>
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
      </div>
    </AppShell>
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
    <Reveal className="lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start lg:gap-10">
      <div className="flex flex-col gap-6">
        <AnimatedStatus id={conflictMessage}>
          <StatusBanner tone="warning" role="alert">
            {conflictMessage}
          </StatusBanner>
        </AnimatedStatus>

        <div>
          <JobStatusBadge status={job.status} />
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">{job.title}</h1>
        </div>

        <AnimatedStatus id={statusError}>
          <StatusBanner tone="danger" role="alert">
            {statusError}
          </StatusBanner>
        </AnimatedStatus>

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
          <p className="max-w-2xl whitespace-pre-wrap text-sm text-text-secondary">{job.description}</p>
        ) : (
          <p className="text-sm text-text-muted">No description.</p>
        )}

        {!canManage ? <p className="text-xs text-text-muted">You have read-only access to this job.</p> : null}
      </div>

      <aside className="mt-6 flex flex-col gap-4 lg:mt-0">
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-text-primary">Details</h2>
          <dl className="mt-3 flex flex-col gap-2 text-xs text-text-muted">
            <div className="flex justify-between gap-2">
              <dt className="font-medium">Created</dt>
              <dd>{new Date(job.createdAt).toLocaleDateString()}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="font-medium">Updated</dt>
              <dd>{new Date(job.updatedAt).toLocaleDateString()}</dd>
            </div>
            {job.closedAt ? (
              <div className="flex justify-between gap-2">
                <dt className="font-medium">Closed</dt>
                <dd>{new Date(job.closedAt).toLocaleDateString()}</dd>
              </div>
            ) : null}
          </dl>
        </Card>

        <div className="flex flex-col gap-2">
          <Link
            href={`/workspaces/${job.workspaceId}/jobs/${job.id}/candidates`}
            className="rounded-lg border border-border-strong px-3 py-1.5 text-center text-xs font-medium text-text-secondary transition hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Candidates
          </Link>
          {canManage && !isEditing ? (
            <>
              <Button size="sm" onClick={onEdit}>
                Edit
              </Button>
              <StatusActions status={job.status} disabled={isChangingStatus} onChange={onStatusChange} />
            </>
          ) : null}
        </div>
      </aside>
    </Reveal>
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
      <Button variant="primary" size="sm" disabled={disabled} onClick={() => onChange("Open")}>
        Open
      </Button>
    );
  }

  if (status === "Open") {
    return (
      <Button variant="danger" size="sm" disabled={disabled} onClick={() => onChange("Closed")}>
        Close
      </Button>
    );
  }

  return (
    <Button size="sm" disabled={disabled} onClick={() => onChange("Open")}>
      Reopen
    </Button>
  );
}
