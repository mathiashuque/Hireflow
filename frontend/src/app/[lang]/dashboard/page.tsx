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
import { useI18n } from "@/i18n/LocaleProvider";
import { roleLabel } from "@/i18n/enumLabels";
import type { Dictionary } from "@/i18n/dictionaries";

type WorkspacesState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "error" }
  | { status: "ready"; workspaces: WorkspaceSummary[] };

export default function DashboardPage() {
  const { status: authStatus, user, retry: retryAuth } = useAuth();
  const router = useRouter();
  const { dict, href } = useI18n();
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
      router.replace(href("/login"));
    }
  }, [authStatus, router, href]);

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
        <SkeletonBlock label={dict.nav.loadingAccount} />
      </AppShell>
    );
  }

  if (authStatus === "unavailable") {
    return (
      <AppShell maxWidth="xl">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="max-w-sm text-sm text-text-secondary">{dict.common.apiUnavailable}</p>
          <Button variant="primary" onClick={retryAuth}>
            {dict.common.tryAgain}
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
    router.push(href(`/workspaces/${workspace.id}`));
  }

  return (
    <AppShell maxWidth="xl">
      <Reveal className="flex flex-1 flex-col gap-10">
        <PageHeader eyebrow={dict.dashboard.welcomeEyebrow} title={user.displayName} />
        <WorkspacesSection
          state={workspacesState}
          onRetry={retryWorkspaces}
          onOpenCreate={() => setIsCreateModalOpen(true)}
          dict={dict}
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
  dict,
}: {
  state: WorkspacesState;
  onRetry: () => void;
  onOpenCreate: () => void;
  dict: Dictionary;
}) {
  const { href } = useI18n();

  if (state.status === "loading") {
    return <SkeletonBlock label={dict.dashboard.loadingWorkspaces} />;
  }

  if (state.status === "unavailable" || state.status === "error") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-surface-muted px-4 py-4">
        <p className="text-sm text-text-secondary">
          {state.status === "unavailable" ? dict.common.apiUnavailable : dict.dashboard.loadFailed}
        </p>
        <Button variant="primary" size="sm" onClick={onRetry}>
          {dict.common.tryAgain}
        </Button>
      </div>
    );
  }

  if (state.workspaces.length === 0) {
    return (
      <EmptyState
        title={dict.dashboard.emptyTitle}
        description={dict.dashboard.emptyDescription}
        action={
          <Button variant="primary" onClick={onOpenCreate}>
            {dict.dashboard.createWorkspace}
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{dict.dashboard.yourWorkspaces}</h2>
          <p className="mt-1 text-sm text-text-secondary">{dict.dashboard.workspaceCount(state.workspaces.length)}</p>
        </div>
        <Button variant="primary" onClick={onOpenCreate}>
          {dict.dashboard.createWorkspace}
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
                href={href(`/workspaces/${workspace.id}`)}
                className="block rounded-lg border border-border bg-surface px-4 py-4 shadow-[var(--shadow-card)] transition hover:border-brand/40 hover:shadow-[var(--shadow-card-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <p className="font-medium text-text-primary">{workspace.name}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-text-muted">{roleLabel(dict, workspace.role)}</p>
              </Link>
            </motion.div>
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}
