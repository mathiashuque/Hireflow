"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ApiUnavailableError } from "@/lib/api/client";
import { acceptInvitation } from "@/lib/api/workspaces";
import { PublicShell } from "@/components/shell/PublicShell";
import { Button } from "@/components/ui/Button";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { fadeIn } from "@/lib/motion";
import { useI18n } from "@/i18n/LocaleProvider";
import type { Dictionary } from "@/i18n/dictionaries";

type AcceptState =
  | { status: "accepting" }
  | { status: "unavailable" }
  | { status: "invalid" }
  | { status: "accepted"; workspaceId: string };

export default function InvitationAcceptPage(props: PageProps<"/[lang]/invitations/[token]">) {
  const { token } = use(props.params);
  const { status: authStatus } = useAuth();
  const router = useRouter();
  const { dict, href } = useI18n();
  const [state, setState] = useState<AcceptState>({ status: "accepting" });

  const accept = useCallback(async (): Promise<AcceptState> => {
    try {
      const result = await acceptInvitation(token);
      return { status: "accepted", workspaceId: result.workspaceId };
    } catch (error) {
      return { status: error instanceof ApiUnavailableError ? "unavailable" : "invalid" };
    }
  }, [token]);

  const retry = useCallback(() => {
    setState({ status: "accepting" });
    void accept().then(setState);
  }, [accept]);

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
    void accept().then((result) => {
      if (!cancelled) {
        setState(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [authStatus, accept]);

  if (authStatus === "loading" || authStatus === "unauthenticated") {
    return (
      <PublicShell>
        <div className="flex flex-1 items-center justify-center py-16">
          <SkeletonBlock label={dict.nav.loadingAccount} className="w-full max-w-sm" />
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <div className="flex flex-1 items-center justify-center py-16">
        <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-[var(--shadow-card)]">
          <AnimatePresence mode="wait">
            <motion.div
              key={state.status}
              initial="hidden"
              animate="show"
              exit="exit"
              variants={fadeIn}
              className="flex w-full flex-col items-center"
            >
              <InvitationContent state={state} onRetry={retry} dict={dict} dashboardHref={href("/dashboard")} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </PublicShell>
  );
}

function InvitationContent({
  state,
  onRetry,
  dict,
  dashboardHref,
}: {
  state: AcceptState;
  onRetry: () => void;
  dict: Dictionary;
  dashboardHref: string;
}) {
  if (state.status === "accepting") {
    return <SkeletonBlock label={dict.invitations.acceptingTitle} className="w-full max-w-sm" />;
  }

  if (state.status === "unavailable") {
    return (
      <div className="flex max-w-sm flex-col items-center gap-3">
        <p className="text-sm text-text-secondary">{dict.common.apiUnavailable}</p>
        <Button variant="primary" onClick={onRetry}>
          {dict.common.tryAgain}
        </Button>
      </div>
    );
  }

  if (state.status === "invalid") {
    return (
      <div className="max-w-sm">
        <h1 className="text-xl font-semibold text-text-primary">{dict.invitations.invalidTitle}</h1>
        <p className="mt-2 text-sm text-text-secondary">{dict.invitations.invalidDescription}</p>
        <Link href={dashboardHref} className="mt-4 inline-block text-sm font-medium text-brand hover:underline">
          {dict.invitations.backToDashboard}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-sm">
      <h1 className="text-xl font-semibold text-text-primary">{dict.invitations.acceptedTitle}</h1>
      <p className="mt-2 text-sm text-text-secondary">{dict.invitations.acceptedDescription}</p>
      <WorkspaceLink workspaceId={state.workspaceId} label={dict.invitations.goToWorkspace} />
    </div>
  );
}

function WorkspaceLink({ workspaceId, label }: { workspaceId: string; label: string }) {
  const { href } = useI18n();
  return (
    <Link
      href={href(`/workspaces/${workspaceId}`)}
      className="mt-4 inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {label}
    </Link>
  );
}
