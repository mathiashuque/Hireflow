"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ApiError, ApiUnavailableError } from "@/lib/api/client";
import { getJob, type JobOpening } from "@/lib/api/jobs";
import { getWorkspace, type WorkspaceDetail } from "@/lib/api/workspaces";
import {
  CANDIDATE_STAGES,
  createCandidate,
  isConcurrencyConflict,
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
import { AppShell } from "@/components/shell/AppShell";
import { Breadcrumbs } from "@/components/shell/Breadcrumbs";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { AnimatedStatus, StatusBanner } from "@/components/ui/StatusBanner";
import { Reveal } from "@/components/motion/Reveal";
import { collapsePanel, staggerContainer, staggerItem } from "@/lib/motion";

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
      <AppShell maxWidth="2xl">
        <SkeletonBlock label="Loading your account…" />
      </AppShell>
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
      if (isConcurrencyConflict(error)) {
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
    <AppShell maxWidth="2xl">
      <Breadcrumbs
        items={[
          { label: "Workspace", href: `/workspaces/${workspaceId}` },
          { label: "Jobs", href: `/workspaces/${workspaceId}/jobs` },
          { label: state.status === "ready" ? state.job.title : "Job", href: `/workspaces/${workspaceId}/jobs/${jobId}` },
          { label: "Candidates" },
        ]}
      />

      <div className="mt-6">
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
      </div>
    </AppShell>
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
    return <SkeletonBlock label="Loading candidates…" />;
  }

  if (state.status === "not-found") {
    return (
      <div className="max-w-md">
        <h1 className="text-xl font-semibold text-text-primary">Job unavailable</h1>
        <p className="mt-2 text-sm text-text-secondary">
          This job doesn&apos;t exist, or you don&apos;t have access to it.
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
            : "Something went wrong loading candidates."}
        </p>
        <Button variant="primary" size="sm" onClick={onRetry}>
          Try again
        </Button>
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
    <Reveal className="flex flex-col gap-8">
      <PageHeader
        title={job.title}
        description="Hiring board for this job"
        actions={
          canManage && !showAddForm ? (
            <Button variant="primary" size="sm" disabled={!canAdd} onClick={onAddClick}>
              Add candidate
            </Button>
          ) : undefined
        }
      />
      <div className="-mt-4">
        <JobStatusBadge status={job.status} />
      </div>

      <AnimatedStatus id={moveNotice}>
        <StatusBanner tone="warning">{moveNotice}</StatusBanner>
      </AnimatedStatus>

      {canManage && !canAdd ? (
        <p className="text-sm text-warning-text">
          {job.status === "Draft"
            ? "This job is still a Draft. Open it before adding candidates."
            : "This job is Closed. Reopen it to add new candidates; existing candidates can still be moved and edited."}
        </p>
      ) : null}

      <motion.div
        variants={collapsePanel}
        initial={false}
        animate={showAddForm && canAdd ? "show" : "hidden"}
        className={showAddForm && canAdd ? "overflow-visible" : "overflow-hidden"}
      >
        {showAddForm && canAdd ? (
          <AddCandidatePanel workspaceId={workspace.id} jobId={job.id} onAdded={onAdded} onCancel={onAddCancel} />
        ) : null}
      </motion.div>

      <div role="group" aria-label="Hiring pipeline board" className="flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-5 sm:overflow-visible">
        {columns.map(({ stage, candidates: stageCandidates }) => (
          <div
            key={stage}
            aria-label={`${stage}, ${stageCandidates.length} candidate${stageCandidates.length === 1 ? "" : "s"}`}
            className="flex w-64 shrink-0 flex-col gap-3 rounded-lg border border-border bg-surface-muted p-3 sm:w-auto"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">{stage}</h2>
              <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-text-secondary ring-1 ring-border">
                {stageCandidates.length}
              </span>
            </div>

            {stageCandidates.length === 0 ? (
              <p className="text-xs text-text-muted">No candidates.</p>
            ) : (
              <motion.ul initial="hidden" animate="show" variants={staggerContainer} layout className="flex flex-col gap-2">
                {stageCandidates.map((candidate) => (
                  <motion.li
                    key={candidate.id}
                    layout
                    variants={staggerItem}
                    className="rounded-lg border border-border bg-surface p-3"
                  >
                    <Link
                      href={`/workspaces/${workspace.id}/candidates/${candidate.id}`}
                      className="text-sm font-medium text-text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
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
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </div>
        ))}
      </div>

      {!canManage ? <p className="text-xs text-text-muted">You have read-only access to this job&apos;s candidates.</p> : null}
    </Reveal>
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
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-text-primary">Add candidate</h2>
      <p className="mt-1 text-sm text-text-muted">New candidates start in the Applied stage.</p>
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
    </Card>
  );
}
