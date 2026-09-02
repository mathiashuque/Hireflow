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

type AcceptState =
  | { status: "accepting" }
  | { status: "unavailable" }
  | { status: "invalid" }
  | { status: "accepted"; workspaceId: string };

export default function InvitationAcceptPage(props: PageProps<"/invitations/[token]">) {
  const { token } = use(props.params);
  const { status: authStatus } = useAuth();
  const router = useRouter();
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
      router.replace("/login");
    }
  }, [authStatus, router]);

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
      <PublicShell maxWidth="md">
        <div className="flex flex-1 items-center justify-center py-16">
          <SkeletonBlock label="Loading your account…" className="w-full max-w-sm" />
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell maxWidth="md">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={state.status}
            initial="hidden"
            animate="show"
            exit="exit"
            variants={fadeIn}
            className="flex w-full flex-col items-center"
          >
            <InvitationContent state={state} onRetry={retry} />
          </motion.div>
        </AnimatePresence>
      </div>
    </PublicShell>
  );
}

function InvitationContent({ state, onRetry }: { state: AcceptState; onRetry: () => void }) {
  if (state.status === "accepting") {
    return <SkeletonBlock label="Accepting your invitation…" className="w-full max-w-sm" />;
  }

  if (state.status === "unavailable") {
    return (
      <div className="flex max-w-sm flex-col items-center gap-3">
        <p className="text-sm text-text-secondary">
          Hireflow can&apos;t reach the API right now. Check that the backend is running and try again.
        </p>
        <Button variant="primary" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if (state.status === "invalid") {
    return (
      <div className="max-w-sm">
        <h1 className="text-xl font-semibold text-text-primary">This invitation isn&apos;t available</h1>
        <p className="mt-2 text-sm text-text-secondary">
          The link may be invalid, expired, already used, or meant for a different account. Ask
          whoever invited you to send a new one if needed.
        </p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-brand hover:underline">
          Go to your dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-sm">
      <h1 className="text-xl font-semibold text-text-primary">You&apos;re in</h1>
      <p className="mt-2 text-sm text-text-secondary">You&apos;ve joined the workspace.</p>
      <Link
        href={`/workspaces/${state.workspaceId}`}
        className="mt-4 inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        Go to the workspace
      </Link>
    </div>
  );
}
