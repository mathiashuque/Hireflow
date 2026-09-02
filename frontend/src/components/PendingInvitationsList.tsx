"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { revokeInvitation, type PendingInvitation } from "@/lib/api/workspaces";
import { Button } from "@/components/ui/Button";
import { AnimatedStatus, StatusBanner } from "@/components/ui/StatusBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { staggerContainer, staggerItem } from "@/lib/motion";

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
    return <EmptyState title="No pending invitations" />;
  }

  return (
    <div className="flex flex-col gap-2">
      <AnimatedStatus id={error}>
        <StatusBanner tone="danger" role="alert">
          {error}
        </StatusBanner>
      </AnimatedStatus>

      <motion.ul
        layout
        initial="hidden"
        animate="show"
        variants={staggerContainer}
        className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface"
      >
        {invitations.map((invitation) => {
          const isExpired = new Date(invitation.expiresAt).getTime() <= now;

          return (
            <motion.li
              key={invitation.id}
              layout
              variants={staggerItem}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <div>
                <p className="text-sm text-text-primary">{invitation.email}</p>
                <p className="text-xs text-text-muted">
                  {invitation.role} · invited by {invitation.invitedByDisplayName} ·{" "}
                  {isExpired ? "expired" : `expires ${new Date(invitation.expiresAt).toLocaleDateString()}`}
                </p>
              </div>
              <Button
                size="sm"
                disabled={revokingId === invitation.id}
                onClick={() => void handleRevoke(invitation.id)}
              >
                {revokingId === invitation.id ? "Revoking…" : "Revoke"}
              </Button>
            </motion.li>
          );
        })}
      </motion.ul>
    </div>
  );
}
