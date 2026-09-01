"use client";

import { useState } from "react";
import type { CreatedInvitation } from "@/lib/api/workspaces";

type OneTimeInvitationLinkProps = {
  invitation: CreatedInvitation;
  onDismiss: () => void;
};

export function OneTimeInvitationLink({ invitation, onDismiss }: OneTimeInvitationLinkProps) {
  const [copied, setCopied] = useState(false);
  const link =
    typeof window !== "undefined" ? `${window.location.origin}/invitations/${invitation.token}` : "";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-4">
      <div>
        <p className="text-sm font-semibold text-slate-950">Invitation created for {invitation.email}</p>
        <p className="mt-1 text-sm text-slate-600">
          Copy this link and send it to them yourself — it will not be shown again.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="flex-1 overflow-x-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800">
          {link}
        </code>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="self-start text-xs font-medium text-indigo-600 hover:underline"
      >
        Done
      </button>
    </div>
  );
}
