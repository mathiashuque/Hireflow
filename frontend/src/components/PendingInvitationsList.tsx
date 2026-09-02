"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { revokeInvitation, type PendingInvitation } from "@/lib/api/workspaces";
import { Button } from "@/components/ui/Button";
import { AnimatedStatus, StatusBanner } from "@/components/ui/StatusBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { useI18n } from "@/i18n/LocaleProvider";
import { roleLabel } from "@/i18n/enumLabels";

type PendingInvitationsListProps = {
  workspaceId: string;
  invitations: PendingInvitation[];
  onRevoked: () => void;
};

export function PendingInvitationsList({ workspaceId, invitations, onRevoked }: PendingInvitationsListProps) {
  const { dict, formatDate } = useI18n();
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
      setError(dict.invitations.revokeFailed);
    } finally {
      setRevokingId(null);
    }
  }

  if (invitations.length === 0) {
    return <EmptyState title={dict.invitations.noPendingInvitations} />;
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
                  {roleLabel(dict, invitation.role)} · {dict.invitations.invitedBy(invitation.invitedByDisplayName)} ·{" "}
                  {isExpired ? dict.invitations.expired : dict.invitations.expires(formatDate(invitation.expiresAt))}
                </p>
              </div>
              <Button
                size="sm"
                disabled={revokingId === invitation.id}
                onClick={() => void handleRevoke(invitation.id)}
              >
                {revokingId === invitation.id ? dict.invitations.revoking : dict.invitations.revoke}
              </Button>
            </motion.li>
          );
        })}
      </motion.ul>
    </div>
  );
}
