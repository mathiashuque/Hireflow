"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ApiUnavailableError } from "@/lib/api/client";
import { listWorkspaces, type WorkspaceDetail, type WorkspaceSummary } from "@/lib/api/workspaces";
import { WorkspaceCreateModal } from "@/components/WorkspaceCreateModal";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/Button";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { staggerContainer, staggerItem, hoverLift } from "@/lib/motion";

type WorkspacesState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "error" }
  | { status: "ready"; workspaces: WorkspaceSummary[] };

export default function DashboardPage() {
  const { status: authStatus, user, retry: retryAuth } = useAuth();
  const router = useRouter();
  const [workspacesState, setWorkspacesState] = useState<WorkspacesState>({ status: "loading" });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchWorkspaces = useCallback(async (): Promise<WorkspacesState> => {
    try {
      const workspaces = await listWorkspaces();
      return { status: "ready", workspaces };
    } catch (error) {
      return { status: error instanceof ApiUnavailableError ? "unavailable" : "error" };
    }
  }, []);

  const retryWorkspaces = useCallback(() => {
    setWorkspacesState({ status: "loading" });
    void fetchWorkspaces().then(setWorkspacesState);
  }, [fetchWorkspaces]);

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
    void fetchWorkspaces().then((result) => {
      if (!cancelled) {
        setWorkspacesState(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [authStatus, fetchWorkspaces]);

  if (authStatus === "loading" || authStatus === "unauthenticated") {
    return (
      <AppShell maxWidth="xl">
        <SkeletonBlock label="Loading your account…" />
      </AppShell>
    );
  }

  if (authStatus === "unavailable") {
    return (
      <AppShell maxWidth="xl">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="max-w-sm text-sm text-text-secondary">
            Hireflow can&apos;t reach the API right now. Check that the backend is running
            and try again.
          </p>
          <Button variant="primary" onClick={retryAuth}>
            Try again
          </Button>
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return null;
  }

  function handleCreated(workspace: WorkspaceDetail) {
    // Navigate immediately without first closing the modal, so it never briefly
    // reappears over the dashboard mid-transition.
    router.push(`/workspaces/${workspace.id}`);
  }

  return (
    <AppShell maxWidth="xl">
      <Reveal className="flex flex-1 flex-col gap-10">
        <PageHeader eyebrow="Welcome" title={user.displayName} />
        <WorkspacesSection
          state={workspacesState}
          onRetry={retryWorkspaces}
          onOpenCreate={() => setIsCreateModalOpen(true)}
        />
      </Reveal>

      <WorkspaceCreateModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={handleCreated}
      />
    </AppShell>
  );
}

function WorkspacesSection({
  state,
  onRetry,
  onOpenCreate,
}: {
  state: WorkspacesState;
  onRetry: () => void;
  onOpenCreate: () => void;
}) {
  if (state.status === "loading") {
    return <SkeletonBlock label="Loading your workspaces…" />;
  }

  if (state.status === "unavailable" || state.status === "error") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-surface-muted px-4 py-4">
        <p className="text-sm text-text-secondary">
          {state.status === "unavailable"
            ? "Hireflow can't reach the API right now. Check that the backend is running and try again."
            : "Something went wrong loading your workspaces."}
        </p>
        <Button variant="primary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if (state.workspaces.length === 0) {
    return (
      <EmptyState
        title="You're not in a workspace yet"
        description="A workspace is where your team's job openings, candidates, and hiring activity live. Create one to get started, or ask a teammate to invite you to theirs."
        action={
          <Button variant="primary" onClick={onOpenCreate}>
            Create workspace
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Your workspaces</h2>
          <p className="mt-1 text-sm text-text-secondary">
            {state.workspaces.length} workspace{state.workspaces.length === 1 ? "" : "s"} you belong to.
          </p>
        </div>
        <Button variant="primary" onClick={onOpenCreate}>
          Create workspace
        </Button>
      </div>

      <motion.ul
        initial="hidden"
        animate="show"
        variants={staggerContainer}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {state.workspaces.map((workspace) => (
          <motion.li key={workspace.id} variants={staggerItem}>
            <motion.div whileHover={hoverLift.whileHover} whileTap={hoverLift.whileTap} transition={hoverLift.transition}>
              <Link
                href={`/workspaces/${workspace.id}`}
                className="block rounded-lg border border-border bg-surface px-4 py-4 shadow-[var(--shadow-card)] transition hover:border-brand/40 hover:shadow-[var(--shadow-card-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <p className="font-medium text-text-primary">{workspace.name}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-text-muted">{workspace.role}</p>
              </Link>
            </motion.div>
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}
