"use client";

import { useState } from "react";
import type { CreatedInvitation } from "@/lib/api/workspaces";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/motion/Reveal";
import { useI18n } from "@/i18n/LocaleProvider";

type OneTimeInvitationLinkProps = {
  invitation: CreatedInvitation;
  onDismiss: () => void;
};

export function OneTimeInvitationLink({ invitation, onDismiss }: OneTimeInvitationLinkProps) {
  const { dict, locale } = useI18n();
  const [copied, setCopied] = useState(false);
  const link =
    typeof window !== "undefined" ? `${window.location.origin}/${locale}/invitations/${invitation.token}` : "";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Reveal variant="fade" className="flex flex-col gap-3 rounded-lg border border-brand/25 bg-brand-soft px-4 py-4">
      <div>
        <p className="text-sm font-semibold text-text-primary">{dict.invitations.createdFor(invitation.email)}</p>
        <p className="mt-1 text-sm text-text-secondary">{dict.invitations.copyInstructions}</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="flex-1 overflow-x-auto rounded-lg border border-border-strong bg-surface px-3 py-2 text-xs text-text-secondary">
          {link}
        </code>
        <Button variant="primary" size="sm" className="shrink-0" onClick={() => void handleCopy()}>
          {copied ? dict.common.linkCopied : dict.common.copyLink}
        </Button>
      </div>

      <button type="button" onClick={onDismiss} className="self-start text-xs font-medium text-brand hover:underline">
        {dict.common.done}
      </button>
    </Reveal>
  );
}
