"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ApiUnavailableError } from "@/lib/api/client";
import { acceptInvitation } from "@/lib/api/workspaces";

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
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-sm text-slate-500">Loading your account…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <Link href="/" className="text-lg font-semibold tracking-tight text-slate-950">
        Hireflow
      </Link>

      <InvitationContent state={state} onRetry={retry} />
    </main>
  );
}

function InvitationContent({ state, onRetry }: { state: AcceptState; onRetry: () => void }) {
  if (state.status === "accepting") {
    return <p className="text-sm text-slate-500">Accepting your invitation…</p>;
  }

  if (state.status === "unavailable") {
    return (
      <div className="flex max-w-sm flex-col items-center gap-3">
        <p className="text-sm text-slate-600">
          Hireflow can&apos;t reach the API right now. Check that the backend is running and try again.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          Try again
        </button>
      </div>
    );
  }

  if (state.status === "invalid") {
    return (
      <div className="max-w-sm">
        <h1 className="text-xl font-semibold text-slate-950">This invitation isn&apos;t available</h1>
        <p className="mt-2 text-sm text-slate-600">
          The link may be invalid, expired, already used, or meant for a different account. Ask
          whoever invited you to send a new one if needed.
        </p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
          Go to your dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-sm">
      <h1 className="text-xl font-semibold text-slate-950">You&apos;re in</h1>
      <p className="mt-2 text-sm text-slate-600">You&apos;ve joined the workspace.</p>
      <Link
        href={`/workspaces/${state.workspaceId}`}
        className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      >
        Go to the workspace
      </Link>
    </div>
  );
}
