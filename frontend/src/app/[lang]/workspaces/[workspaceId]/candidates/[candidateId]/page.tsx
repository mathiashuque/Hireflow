"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ApiError, ApiUnavailableError } from "@/lib/api/client";
import { getWorkspace } from "@/lib/api/workspaces";
import {
  createCandidateNote,
  getCandidate,
  getCandidateHistory,
  getCandidateNotes,
  isConcurrencyConflict,
  isDuplicateEmailConflict,
  isNoOpStageConflict,
  moveCandidateStage,
  updateCandidate,
  type Candidate,
  type CandidateNote,
  type CandidateStage,
  type CandidateStageHistoryEntry,
} from "@/lib/api/candidates";
import { CandidateStageBadge } from "@/components/CandidateStageBadge";
import { CandidateDetailsForm } from "@/components/CandidateDetailsForm";
import { CandidateStageMoveControl } from "@/components/CandidateStageMoveControl";
import { CandidateStageHistoryTimeline } from "@/components/CandidateStageHistoryTimeline";
import { CandidateNotesTimeline } from "@/components/CandidateNotesTimeline";
import { CandidateNoteComposer } from "@/components/CandidateNoteComposer";
import { AppShell } from "@/components/shell/AppShell";
import { Breadcrumbs } from "@/components/shell/Breadcrumbs";
import { Button } from "@/components/ui/Button";
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
  | {
      status: "ready";
      candidate: Candidate;
      canManage: boolean;
      history: CandidateStageHistoryEntry[];
      notes: CandidateNote[];
    };

export default function CandidateDetailPage(props: PageProps<"/[lang]/workspaces/[workspaceId]/candidates/[candidateId]">) {
  const { workspaceId, candidateId } = use(props.params);
  const { status: authStatus, user } = useAuth();
  const router = useRouter();
  const { dict, href, formatDateTime } = useI18n();
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [isEditing, setIsEditing] = useState(false);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  const fetchState = useCallback(async (): Promise<PageState> => {
    try {
      const workspace = await getWorkspace(workspaceId);
      if (!workspace) {
        return { status: "not-found" };
      }

      const candidate = await getCandidate(workspaceId, candidateId);
      if (!candidate) {
        return { status: "not-found" };
      }

      const history = await getCandidateHistory(workspaceId, candidateId);
      if (!history) {
        return { status: "not-found" };
      }

      const notes = await getCandidateNotes(workspaceId, candidateId);
      if (!notes) {
        return { status: "not-found" };
      }

      // This only decides which controls the UI shows; the backend independently
      // enforces every mutation regardless of what the client believes the role is.
      const canManage = workspace.role === "Owner" || workspace.role === "Recruiter";

      return { status: "ready", candidate, canManage, history, notes };
    } catch (error) {
      return { status: error instanceof ApiUnavailableError ? "unavailable" : "error" };
    }
  }, [workspaceId, candidateId]);

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

  async function handleSaveEdit(input: { name: string; email: string }) {
    if (state.status !== "ready") {
      return;
    }

    setConflictMessage(null);
    try {
      const updated = await updateCandidate(workspaceId, candidateId, {
        name: input.name,
        email: input.email,
        version: state.candidate.version,
      });
      setState({ status: "ready", candidate: updated, canManage: state.canManage, history: state.history, notes: state.notes });
      setIsEditing(false);
    } catch (error) {
      if (isConcurrencyConflict(error)) {
        setConflictMessage(dict.candidates.conflictEdit);
        refresh();
        return;
      }
      if (isDuplicateEmailConflict(error)) {
        throw new Error(dict.candidates.duplicateEmail);
      }
      if (error instanceof ApiUnavailableError) {
        throw error;
      }
      if (error instanceof ApiError) {
        throw new Error(error.fieldErrors.Name?.[0] ?? dict.errors.validation_error);
      }
      throw new Error(dict.common.genericError);
    }
  }

  async function handleMoveStage(target: CandidateStage) {
    if (state.status !== "ready") {
      return;
    }

    setConflictMessage(null);
    try {
      await moveCandidateStage(workspaceId, candidateId, { stage: target, version: state.candidate.version });
      refresh();
    } catch (error) {
      if (isNoOpStageConflict(error)) {
        throw new Error(dict.candidates.moveAlreadyInStage);
      }
      if (isConcurrencyConflict(error)) {
        setConflictMessage(dict.candidates.conflictStage);
        refresh();
        return;
      }
      if (error instanceof ApiUnavailableError) {
        throw error;
      }
      if (error instanceof ApiError && error.status === 403) {
        throw new Error(dict.candidates.movePermissionDenied);
      }
      throw new Error(dict.candidates.moveFailed);
    }
  }

  async function handleAddNote(content: string) {
    if (state.status !== "ready") {
      return;
    }

    try {
      const note = await createCandidateNote(workspaceId, candidateId, content);
      setState((current) =>
        current.status === "ready" ? { ...current, notes: [...current.notes, note] } : current,
      );
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        throw error;
      }
      if (error instanceof ApiError) {
        throw new Error(error.fieldErrors.Content?.[0] ?? dict.errors.validation_error);
      }
      throw new Error(dict.candidates.noteFailed);
    }
  }

  const candidatesHref =
    state.status === "ready" ? href(`/workspaces/${workspaceId}/jobs/${state.candidate.jobOpeningId}/candidates`) : undefined;

  return (
    <AppShell maxWidth="xl">
      <Breadcrumbs
        items={[
          { label: dict.nav.workspaceOverview, href: href(`/workspaces/${workspaceId}`) },
          { label: dict.nav.workspaceJobs, href: href(`/workspaces/${workspaceId}/jobs`) },
          ...(candidatesHref ? [{ label: dict.jobs.candidatesLink, href: candidatesHref }] : []),
          { label: state.status === "ready" ? state.candidate.name : dict.candidates.unavailableTitle },
        ]}
      />

      <div className="mt-6">
        {state.status === "loading" && <SkeletonBlock label={dict.candidates.loadingCandidate} />}

        {state.status === "not-found" && (
          <div className="max-w-md">
            <h1 className="text-xl font-semibold text-text-primary">{dict.candidates.unavailableTitle}</h1>
            <p className="mt-2 text-sm text-text-secondary">{dict.candidates.unavailableDescription}</p>
            <Link href={href("/dashboard")} className="mt-4 inline-block text-sm font-medium text-brand hover:underline">
              {dict.jobs.backToWorkspaces}
            </Link>
          </div>
        )}

        {(state.status === "unavailable" || state.status === "error") && (
          <div className="flex max-w-md flex-col items-start gap-3">
            <p className="text-sm text-text-secondary">
              {state.status === "unavailable" ? dict.common.apiUnavailable : dict.candidates.loadFailed}
            </p>
            <Button variant="primary" size="sm" onClick={retry}>
              {dict.common.tryAgain}
            </Button>
          </div>
        )}

        {state.status === "ready" && (
          <CandidateDetail
            candidate={state.candidate}
            canManage={state.canManage}
            history={state.history}
            notes={state.notes}
            isEditing={isEditing}
            conflictMessage={conflictMessage}
            onEdit={() => setIsEditing(true)}
            onCancelEdit={() => setIsEditing(false)}
            onSaveEdit={handleSaveEdit}
            onMoveStage={handleMoveStage}
            onAddNote={handleAddNote}
            dict={dict}
            formatDateTime={formatDateTime}
          />
        )}
      </div>
    </AppShell>
  );
}

function CandidateDetail({
  candidate,
  canManage,
  history,
  notes,
  isEditing,
  conflictMessage,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onMoveStage,
  onAddNote,
  dict,
  formatDateTime,
}: {
  candidate: Candidate;
  canManage: boolean;
  history: CandidateStageHistoryEntry[];
  notes: CandidateNote[];
  isEditing: boolean;
  conflictMessage: string | null;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (input: { name: string; email: string }) => Promise<void>;
  onMoveStage: (target: CandidateStage) => Promise<void>;
  onAddNote: (content: string) => Promise<void>;
  dict: Dictionary;
  formatDateTime: (iso: string) => string;
}) {
  return (
    <Reveal className="flex flex-col gap-8">
      <AnimatedStatus id={conflictMessage}>
        <StatusBanner tone="warning" role="alert">
          {conflictMessage}
        </StatusBanner>
      </AnimatedStatus>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <CandidateStageBadge stage={candidate.stage} />
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">{candidate.name}</h1>
          <p className="mt-1 text-sm text-text-secondary">{candidate.email}</p>
          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
            <div>
              <dt className="inline font-medium">{dict.candidates.added}</dt> <dd className="inline">{formatDateTime(candidate.createdAt)}</dd>
            </div>
            <div>
              <dt className="inline font-medium">{dict.candidates.updated}</dt> <dd className="inline">{formatDateTime(candidate.updatedAt)}</dd>
            </div>
          </dl>
        </div>

        {canManage && !isEditing ? (
          <Button size="sm" onClick={onEdit}>
            {dict.candidates.edit}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-6">
          {canManage ? (
            <div>
              <h2 className="text-sm font-semibold text-text-primary">{dict.candidates.moveStage}</h2>
              <div className="mt-2">
                <CandidateStageMoveControl currentStage={candidate.stage} labelPrefix={dict.candidates.moveCandidatePrefix} onMove={onMoveStage} />
              </div>
            </div>
          ) : null}

          {isEditing ? (
            <CandidateDetailsForm
              initialName={candidate.name}
              initialEmail={candidate.email}
              submitLabel={dict.candidates.saveChanges}
              submittingLabel={dict.candidates.savingChanges}
              onCancel={onCancelEdit}
              onSubmit={onSaveEdit}
            />
          ) : null}

          {!canManage ? <p className="text-xs text-text-muted">{dict.candidates.readOnlyNotice}</p> : null}

          <div>
            <h2 className="text-sm font-semibold text-text-primary">{dict.candidates.stageHistory}</h2>
            <div className="mt-2">
              <CandidateStageHistoryTimeline history={history} />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-text-primary">{dict.candidates.internalNotes}</h2>
          <div className="mt-2">
            <CandidateNoteComposer onSubmit={onAddNote} />
          </div>
          <div className="mt-4">
            <CandidateNotesTimeline notes={notes} />
          </div>
        </div>
      </div>
    </Reveal>
  );
}
