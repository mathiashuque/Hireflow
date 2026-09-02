"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ApiUnavailableError } from "@/lib/api/client";
import {
  getWorkspace,
  listPendingInvitations,
  listWorkspaceMembers,
  type CreatedInvitation,
  type PendingInvitation,
  type WorkspaceDetail,
  type WorkspaceMember,
} from "@/lib/api/workspaces";
import { InviteMemberForm } from "@/components/InviteMemberForm";
import { OneTimeInvitationLink } from "@/components/OneTimeInvitationLink";
import { PendingInvitationsList } from "@/components/PendingInvitationsList";
import { MembersList } from "@/components/MembersList";
import { WorkspaceNav } from "@/components/WorkspaceNav";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { Reveal } from "@/components/motion/Reveal";
import { useI18n } from "@/i18n/LocaleProvider";
import { roleLabel } from "@/i18n/enumLabels";

type PageState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "not-found" }
  | { status: "error" }
  | {
      status: "ready";
      workspace: WorkspaceDetail;
      members: WorkspaceMember[];
      invitations: PendingInvitation[] | null;
    };

export default function WorkspaceMembersPage(props: PageProps<"/[lang]/workspaces/[workspaceId]/members">) {
  const { workspaceId } = use(props.params);
  const { status: authStatus, user } = useAuth();
  const router = useRouter();
  const { dict, href } = useI18n();
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [justCreated, setJustCreated] = useState<CreatedInvitation | null>(null);

  const fetchState = useCallback(async (): Promise<PageState> => {
    try {
      const workspace = await getWorkspace(workspaceId);
      if (!workspace) {
        return { status: "not-found" };
      }

      const members = await listWorkspaceMembers(workspaceId);
      if (!members) {
        // Membership was revoked between the two calls; treat it the same as not found
        // rather than showing a workspace with no member list.
        return { status: "not-found" };
      }

      const invitations = workspace.role === "Owner" ? await listPendingInvitations(workspaceId) : null;

      return { status: "ready", workspace, members, invitations };
    } catch (error) {
      return { status: error instanceof ApiUnavailableError ? "unavailable" : "error" };
    }
  }, [workspaceId]);

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

  return (
    <AppShell maxWidth="xl">
      <WorkspaceContent
        state={state}
        currentUserId={user.id}
        justCreated={justCreated}
        onRetry={retry}
        onInvitationCreated={(invitation) => {
          setJustCreated(invitation);
          refresh();
        }}
        onDismissJustCreated={() => setJustCreated(null)}
        onMutated={refresh}
      />
    </AppShell>
  );
}

function WorkspaceContent({
  state,
  currentUserId,
  justCreated,
  onRetry,
  onInvitationCreated,
  onDismissJustCreated,
  onMutated,
}: {
  state: PageState;
  currentUserId: string;
  justCreated: CreatedInvitation | null;
  onRetry: () => void;
  onInvitationCreated: (invitation: CreatedInvitation) => void;
  onDismissJustCreated: () => void;
  onMutated: () => void;
}) {
  const { dict, href } = useI18n();

  if (state.status === "loading") {
    return <SkeletonBlock label={dict.members.loadingWorkspace} />;
  }

  if (state.status === "not-found") {
    return (
      <div className="max-w-md">
        <h1 className="text-xl font-semibold text-text-primary">{dict.members.unavailableTitle}</h1>
        <p className="mt-2 text-sm text-text-secondary">{dict.members.unavailableDescription}</p>
        <Link href={href("/dashboard")} className="mt-4 inline-block text-sm font-medium text-brand hover:underline">
          {dict.workspaces.backToWorkspaces}
        </Link>
      </div>
    );
  }

  if (state.status === "unavailable" || state.status === "error") {
    return (
      <div className="flex max-w-md flex-col items-start gap-3">
        <p className="text-sm text-text-secondary">
          {state.status === "unavailable" ? dict.common.apiUnavailable : dict.members.loadFailed}
        </p>
        <Button variant="primary" size="sm" onClick={onRetry}>
          {dict.common.tryAgain}
        </Button>
      </div>
    );
  }

  const { workspace, members, invitations } = state;
  const isOwner = workspace.role === "Owner";

  return (
    <Reveal className="flex flex-col gap-8">
      <PageHeader eyebrow={roleLabel(dict, workspace.role)} title={workspace.name} description={`/${workspace.slug}`} />

      <WorkspaceNav workspaceId={workspace.id} />

      <div className={isOwner ? "grid gap-10 lg:grid-cols-2 lg:items-start" : "flex flex-col gap-8"}>
        <div>
          <h2 className="text-sm font-semibold text-text-primary">{dict.members.members}</h2>
          <div className="mt-3">
            <MembersList
              workspaceId={workspace.id}
              members={members}
              currentUserId={currentUserId}
              canManage={isOwner}
              onChanged={onMutated}
            />
          </div>
        </div>

        {isOwner ? (
          <div className="flex flex-col gap-8">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">{dict.members.inviteSomeone}</h2>
              <div className="mt-3 flex flex-col gap-4">
                {justCreated ? (
                  <OneTimeInvitationLink invitation={justCreated} onDismiss={onDismissJustCreated} />
                ) : (
                  <InviteMemberForm workspaceId={workspace.id} onCreated={onInvitationCreated} />
                )}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-text-primary">{dict.members.pendingInvitations}</h2>
              <div className="mt-3">
                <PendingInvitationsList
                  workspaceId={workspace.id}
                  invitations={invitations ?? []}
                  onRevoked={onMutated}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Reveal>
  );
}
