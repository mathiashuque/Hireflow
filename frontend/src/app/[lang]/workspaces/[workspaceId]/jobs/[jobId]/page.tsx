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
import { useI18n } from "@/i18n/LocaleProvider";
import type { Dictionary } from "@/i18n/dictionaries";

type PageState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; job: JobOpening; canManage: boolean };

export default function JobDetailPage(props: PageProps<"/[lang]/workspaces/[workspaceId]/jobs/[jobId]">) {
  const { workspaceId, jobId } = use(props.params);
  const { status: authStatus, user } = useAuth();
  const router = useRouter();
  const { dict, href, formatDate } = useI18n();
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
        setConflictMessage(dict.jobs.conflictEdit);
        refresh();
        return;
      }
      if (error instanceof ApiUnavailableError) {
        throw error;
      }
      if (error instanceof ApiError) {
        throw new Error(error.fieldErrors.Title?.[0] ?? dict.errors.validation_error);
      }
      throw new Error(dict.common.genericError);
    }
  }

  async function handleStatusChange(target: "Open" | "Closed") {
    if (state.status !== "ready") {
      return;
    }

    if (target === "Closed" && !window.confirm(dict.jobs.confirmClose)) {
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
        setConflictMessage(dict.jobs.conflictStatus);
        refresh();
      } else if (error instanceof ApiError && isInvalidTransitionConflict(error)) {
        setStatusError(dict.errors.invalid_job_transition);
      } else if (error instanceof ApiUnavailableError) {
        setStatusError(dict.common.apiUnavailable);
      } else if (error instanceof ApiError) {
        setStatusError(dict.errors.generic);
      } else {
        setStatusError(dict.common.genericError);
      }
    } finally {
      setIsChangingStatus(false);
    }
  }

  return (
    <AppShell maxWidth="xl">
      <Breadcrumbs
        items={[
          { label: dict.nav.workspaceOverview, href: href(`/workspaces/${workspaceId}`) },
          { label: dict.nav.workspaceJobs, href: href(`/workspaces/${workspaceId}/jobs`) },
          { label: state.status === "ready" ? state.job.title : dict.jobs.newJob },
        ]}
      />

      <div className="mt-6">
        {state.status === "loading" && <SkeletonBlock label={dict.jobs.loadingJob} />}

        {state.status === "not-found" && (
          <div className="max-w-md">
            <h1 className="text-xl font-semibold text-text-primary">{dict.jobs.unavailableTitle}</h1>
            <p className="mt-2 text-sm text-text-secondary">{dict.jobs.unavailableDescription}</p>
            <Link href={href(`/workspaces/${workspaceId}/jobs`)} className="mt-4 inline-block text-sm font-medium text-brand hover:underline">
              {dict.jobs.backToJobs}
            </Link>
          </div>
        )}

        {(state.status === "unavailable" || state.status === "error") && (
          <div className="flex max-w-md flex-col items-start gap-3">
            <p className="text-sm text-text-secondary">
              {state.status === "unavailable" ? dict.common.apiUnavailable : dict.jobs.loadFailedSingle}
            </p>
            <Button variant="primary" size="sm" onClick={retry}>
              {dict.common.tryAgain}
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
            dict={dict}
            href={href}
            formatDate={formatDate}
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
  dict,
  href,
  formatDate,
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
  dict: Dictionary;
  href: (path: string) => string;
  formatDate: (iso: string) => string;
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
            submitLabel={dict.jobs.saveChanges}
            submittingLabel={dict.jobs.savingChanges}
            onCancel={onCancelEdit}
            onSubmit={onSaveEdit}
          />
        ) : job.description ? (
          <p className="max-w-2xl whitespace-pre-wrap text-sm text-text-secondary">{job.description}</p>
        ) : (
          <p className="text-sm text-text-muted">{dict.jobs.noDescription}</p>
        )}

        {!canManage ? <p className="text-xs text-text-muted">{dict.jobs.readOnlyNotice}</p> : null}
      </div>

      <aside className="mt-6 flex flex-col gap-4 lg:mt-0">
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-text-primary">{dict.jobs.detailsHeading}</h2>
          <dl className="mt-3 flex flex-col gap-2 text-xs text-text-muted">
            <div className="flex justify-between gap-2">
              <dt className="font-medium">{dict.jobs.created}</dt>
              <dd>{formatDate(job.createdAt)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="font-medium">{dict.jobs.updated}</dt>
              <dd>{formatDate(job.updatedAt)}</dd>
            </div>
            {job.closedAt ? (
              <div className="flex justify-between gap-2">
                <dt className="font-medium">{dict.jobs.closed}</dt>
                <dd>{formatDate(job.closedAt)}</dd>
              </div>
            ) : null}
          </dl>
        </Card>

        <div className="flex flex-col gap-2">
          <Link
            href={href(`/workspaces/${job.workspaceId}/jobs/${job.id}/candidates`)}
            className="rounded-lg border border-border-strong px-3 py-1.5 text-center text-xs font-medium text-text-secondary transition hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {dict.jobs.candidatesLink}
          </Link>
          {canManage && !isEditing ? (
            <>
              <Button size="sm" onClick={onEdit}>
                {dict.jobs.editJob}
              </Button>
              <StatusActions status={job.status} disabled={isChangingStatus} onChange={onStatusChange} dict={dict} />
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
  dict,
}: {
  status: JobStatus;
  disabled: boolean;
  onChange: (target: "Open" | "Closed") => void;
  dict: Dictionary;
}) {
  if (status === "Draft") {
    return (
      <Button variant="primary" size="sm" disabled={disabled} onClick={() => onChange("Open")}>
        {dict.jobs.openAction}
      </Button>
    );
  }

  if (status === "Open") {
    return (
      <Button variant="danger" size="sm" disabled={disabled} onClick={() => onChange("Closed")}>
        {dict.jobs.closeAction}
      </Button>
    );
  }

  return (
    <Button size="sm" disabled={disabled} onClick={() => onChange("Open")}>
      {dict.jobs.reopenAction}
    </Button>
  );
}
