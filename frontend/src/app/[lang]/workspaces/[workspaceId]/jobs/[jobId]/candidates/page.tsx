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
  isConcurrencyConflict,
  isNoOpStageConflict,
  listCandidates,
  moveCandidateStage,
  type Candidate,
  type CandidateStage,
} from "@/lib/api/candidates";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import { AddCandidateModal } from "@/components/AddCandidateModal";
import { CandidateStageMoveControl } from "@/components/CandidateStageMoveControl";
import { AppShell } from "@/components/shell/AppShell";
import { Breadcrumbs } from "@/components/shell/Breadcrumbs";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { AnimatedStatus, StatusBanner } from "@/components/ui/StatusBanner";
import { Reveal } from "@/components/motion/Reveal";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { useI18n } from "@/i18n/LocaleProvider";
import { candidateStageLabel } from "@/i18n/enumLabels";

type PageState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; workspace: WorkspaceDetail; job: JobOpening; candidates: Candidate[] };

export default function JobCandidatesPage(props: PageProps<"/[lang]/workspaces/[workspaceId]/jobs/[jobId]/candidates">) {
  const { workspaceId, jobId } = use(props.params);
  const { status: authStatus, user } = useAuth();
  const router = useRouter();
  const { dict, href } = useI18n();
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [showAddModal, setShowAddModal] = useState(false);
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
      <AppShell maxWidth="2xl">
        <SkeletonBlock label={dict.nav.loadingAccount} />
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
        throw new Error(dict.jobs.moveCandidateAlreadyInStage);
      }
      if (isConcurrencyConflict(error)) {
        setMoveNotice(dict.jobs.moveNotice(candidate.name));
        refresh();
        return;
      }
      if (error instanceof ApiError && error.status === 403) {
        throw new Error(dict.jobs.movePermissionDenied);
      }
      throw new Error(dict.jobs.moveFailed);
    }
  }

  return (
    <AppShell maxWidth="2xl">
      <Breadcrumbs
        items={[
          { label: dict.nav.workspaceOverview, href: href(`/workspaces/${workspaceId}`) },
          { label: dict.nav.workspaceJobs, href: href(`/workspaces/${workspaceId}/jobs`) },
          {
            label: state.status === "ready" ? state.job.title : dict.jobs.newJob,
            href: href(`/workspaces/${workspaceId}/jobs/${jobId}`),
          },
          { label: dict.jobs.candidatesLink },
        ]}
      />

      <div className="mt-6">
        <BoardContent
          state={state}
          moveNotice={moveNotice}
          onRetry={retry}
          onAddClick={() => setShowAddModal(true)}
          onMove={handleMove}
        />
      </div>

      {state.status === "ready" ? (
        <AddCandidateModal
          open={showAddModal}
          workspaceId={state.workspace.id}
          jobId={state.job.id}
          onClose={() => setShowAddModal(false)}
          onAdded={() => {
            setShowAddModal(false);
            refresh();
          }}
        />
      ) : null}
    </AppShell>
  );
}

function BoardContent({
  state,
  moveNotice,
  onRetry,
  onAddClick,
  onMove,
}: {
  state: PageState;
  moveNotice: string | null;
  onRetry: () => void;
  onAddClick: () => void;
  onMove: (candidate: Candidate, target: CandidateStage) => Promise<void>;
}) {
  const { dict, href } = useI18n();

  if (state.status === "loading") {
    return <SkeletonBlock label={dict.candidates.loadingCandidates} />;
  }

  if (state.status === "not-found") {
    return (
      <div className="max-w-md">
        <h1 className="text-xl font-semibold text-text-primary">{dict.jobs.unavailableTitle}</h1>
        <p className="mt-2 text-sm text-text-secondary">{dict.jobs.unavailableDescription}</p>
        <Link href={href("/dashboard")} className="mt-4 inline-block text-sm font-medium text-brand hover:underline">
          {dict.jobs.backToWorkspaces}
        </Link>
      </div>
    );
  }

  if (state.status === "unavailable" || state.status === "error") {
    return (
      <div className="flex max-w-md flex-col items-start gap-3">
        <p className="text-sm text-text-secondary">
          {state.status === "unavailable" ? dict.common.apiUnavailable : dict.jobs.loadFailedCandidates}
        </p>
        <Button variant="primary" size="sm" onClick={onRetry}>
          {dict.common.tryAgain}
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
        description={dict.jobs.boardDescription}
        actions={
          canManage ? (
            <Button variant="primary" size="sm" disabled={!canAdd} onClick={onAddClick}>
              {dict.jobs.addCandidate}
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
          {job.status === "Draft" ? dict.jobs.draftNotice : dict.jobs.closedNotice}
        </p>
      ) : null}

      <div role="group" aria-label={dict.a11y.pipelineBoard} className="flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-5 sm:overflow-visible">
        {columns.map(({ stage, candidates: stageCandidates }) => (
          <div
            key={stage}
            aria-label={dict.jobs.stageColumnLabel(candidateStageLabel(dict, stage), stageCandidates.length)}
            className="flex w-64 shrink-0 flex-col gap-3 rounded-lg border border-border bg-surface-muted p-3 sm:w-auto"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">{candidateStageLabel(dict, stage)}</h2>
              <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-text-secondary ring-1 ring-border">
                {stageCandidates.length}
              </span>
            </div>

            {stageCandidates.length === 0 ? (
              <p className="text-xs text-text-muted">{dict.jobs.noCandidatesInStage}</p>
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
                      href={href(`/workspaces/${workspace.id}/candidates/${candidate.id}`)}
                      className="text-sm font-medium text-text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      {candidate.name}
                    </Link>
                    {canManage ? (
                      <div className="mt-2">
                        <CandidateStageMoveControl
                          currentStage={candidate.stage}
                          labelPrefix={dict.candidates.movePrefix(candidate.name)}
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

      {!canManage ? <p className="text-xs text-text-muted">{dict.jobs.readOnlyCandidatesNotice}</p> : null}
    </Reveal>
  );
}
