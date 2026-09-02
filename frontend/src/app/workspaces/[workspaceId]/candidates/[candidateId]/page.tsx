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

export default function CandidateDetailPage(props: PageProps<"/workspaces/[workspaceId]/candidates/[candidateId]">) {
  const { workspaceId, candidateId } = use(props.params);
  const { status: authStatus, user } = useAuth();
  const router = useRouter();
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
        setConflictMessage("This candidate was changed by someone else. The latest version is now shown below — please redo your edit.");
        refresh();
        return;
      }
      if (isDuplicateEmailConflict(error)) {
        throw new Error("A candidate with this email already exists for this job.");
      }
      if (error instanceof ApiUnavailableError) {
        throw error;
      }
      if (error instanceof ApiError) {
        throw new Error(error.fieldErrors.Name?.[0] ?? error.message);
      }
      throw new Error("Something went wrong. Please try again.");
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
        throw new Error("The candidate is already in this stage.");
      }
      if (isConcurrencyConflict(error)) {
        setConflictMessage("This candidate was changed by someone else. The latest version is now shown below.");
        refresh();
        return;
      }
      if (error instanceof ApiUnavailableError) {
        throw error;
      }
      if (error instanceof ApiError && error.status === 403) {
        throw new Error("You don't have permission to move this candidate.");
      }
      throw new Error("Something went wrong moving this candidate. Please try again.");
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
        throw new Error(error.fieldErrors.Content?.[0] ?? error.message);
      }
      throw new Error("Something went wrong adding this note. Please try again.");
    }
  }

  const candidatesHref =
    state.status === "ready" ? `/workspaces/${workspaceId}/jobs/${state.candidate.jobOpeningId}/candidates` : undefined;

  return (
    <AppShell maxWidth="xl">
      <Breadcrumbs
        items={[
          { label: "Workspace", href: `/workspaces/${workspaceId}` },
          { label: "Jobs", href: `/workspaces/${workspaceId}/jobs` },
          ...(candidatesHref ? [{ label: "Candidates", href: candidatesHref }] : []),
          { label: state.status === "ready" ? state.candidate.name : "Candidate" },
        ]}
      />

      <div className="mt-6">
        {state.status === "loading" && <SkeletonBlock label="Loading candidate…" />}

        {state.status === "not-found" && (
          <div className="max-w-md">
            <h1 className="text-xl font-semibold text-text-primary">Candidate unavailable</h1>
            <p className="mt-2 text-sm text-text-secondary">
              This candidate doesn&apos;t exist, or you don&apos;t have access to it.
            </p>
            <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-brand hover:underline">
              Back to your workspaces
            </Link>
          </div>
        )}

        {(state.status === "unavailable" || state.status === "error") && (
          <div className="flex max-w-md flex-col items-start gap-3">
            <p className="text-sm text-text-secondary">
              {state.status === "unavailable"
                ? "Hireflow can't reach the API right now. Check that the backend is running and try again."
                : "Something went wrong loading this candidate."}
            </p>
            <Button variant="primary" size="sm" onClick={retry}>
              Try again
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
              <dt className="inline font-medium">Added</dt> <dd className="inline">{new Date(candidate.createdAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Updated</dt> <dd className="inline">{new Date(candidate.updatedAt).toLocaleString()}</dd>
            </div>
          </dl>
        </div>

        {canManage && !isEditing ? (
          <Button size="sm" onClick={onEdit}>
            Edit
          </Button>
        ) : null}
      </div>

      <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-6">
          {canManage ? (
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Move stage</h2>
              <div className="mt-2">
                <CandidateStageMoveControl currentStage={candidate.stage} labelPrefix="Move candidate to" onMove={onMoveStage} />
              </div>
            </div>
          ) : null}

          {isEditing ? (
            <CandidateDetailsForm
              initialName={candidate.name}
              initialEmail={candidate.email}
              submitLabel="Save changes"
              submittingLabel="Saving…"
              onCancel={onCancelEdit}
              onSubmit={onSaveEdit}
            />
          ) : null}

          {!canManage ? <p className="text-xs text-text-muted">You have read-only access to this candidate.</p> : null}

          <div>
            <h2 className="text-sm font-semibold text-text-primary">Stage history</h2>
            <div className="mt-2">
              <CandidateStageHistoryTimeline history={history} />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-text-primary">Internal notes</h2>
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
