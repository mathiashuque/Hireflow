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

export default function WorkspacePage(props: PageProps<"/workspaces/[workspaceId]">) {
  const { workspaceId } = use(props.params);
  const { status: authStatus, user } = useAuth();
  const router = useRouter();
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

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-8 sm:px-10">
      <nav className="flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-950">
          Hireflow
        </Link>
        <Link href="/dashboard" className="text-sm font-medium text-indigo-600 hover:underline">
          Back to workspaces
        </Link>
      </nav>

      <section className="flex-1 py-12">
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
      </section>
    </main>
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
  if (state.status === "loading") {
    return <p className="text-sm text-slate-500">Loading workspace…</p>;
  }

  if (state.status === "not-found") {
    return (
      <div className="max-w-md">
        <h1 className="text-xl font-semibold text-slate-950">Workspace unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">
          This workspace doesn&apos;t exist, or you don&apos;t have access to it.
        </p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
          Back to your workspaces
        </Link>
      </div>
    );
  }

  if (state.status === "unavailable" || state.status === "error") {
    return (
      <div className="flex max-w-md flex-col items-start gap-3">
        <p className="text-sm text-slate-600">
          {state.status === "unavailable"
            ? "Hireflow can't reach the API right now. Check that the backend is running and try again."
            : "Something went wrong loading this workspace."}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          Try again
        </button>
      </div>
    );
  }

  const { workspace, members, invitations } = state;
  const isOwner = workspace.role === "Owner";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">{workspace.role}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{workspace.name}</h1>
        <p className="mt-1 text-sm text-slate-500">/{workspace.slug}</p>
      </div>

      <WorkspaceNav workspaceId={workspace.id} />

      <div className="flex flex-col gap-10">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">Members</h2>
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
              <h2 className="text-sm font-semibold text-slate-950">Invite someone</h2>
              <div className="mt-3 flex flex-col gap-4">
                {justCreated ? (
                  <OneTimeInvitationLink invitation={justCreated} onDismiss={onDismissJustCreated} />
                ) : (
                  <InviteMemberForm workspaceId={workspace.id} onCreated={onInvitationCreated} />
                )}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-950">Pending invitations</h2>
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
    </div>
  );
}
