"use client";

import { useState } from "react";
import { revokeInvitation, type PendingInvitation } from "@/lib/api/workspaces";

type PendingInvitationsListProps = {
  workspaceId: string;
  invitations: PendingInvitation[];
  onRevoked: () => void;
};

export function PendingInvitationsList({ workspaceId, invitations, onRevoked }: PendingInvitationsListProps) {
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  async function handleRevoke(invitationId: string) {
    setError(null);
    setRevokingId(invitationId);
    try {
      await revokeInvitation(workspaceId, invitationId);
      onRevoked();
    } catch {
      setError("Could not revoke this invitation. Please try again.");
    } finally {
      setRevokingId(null);
    }
  }

  if (invitations.length === 0) {
    return <p className="text-sm text-slate-500">No pending invitations.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
        {invitations.map((invitation) => {
          const isExpired = new Date(invitation.expiresAt).getTime() <= now;

          return (
            <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <p className="text-sm text-slate-900">{invitation.email}</p>
                <p className="text-xs text-slate-500">
                  {invitation.role} · invited by {invitation.invitedByDisplayName} ·{" "}
                  {isExpired ? "expired" : `expires ${new Date(invitation.expiresAt).toLocaleDateString()}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleRevoke(invitation.id)}
                disabled={revokingId === invitation.id}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {revokingId === invitation.id ? "Revoking…" : "Revoke"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
