"use client";

import { useState } from "react";
import { FormField } from "@/components/FormField";
import { Button } from "@/components/ui/Button";
import { AnimatedStatus, StatusBanner } from "@/components/ui/StatusBanner";
import { ApiError, ApiUnavailableError } from "@/lib/api/client";
import { createInvitation, type CreatedInvitation, type InvitableRole } from "@/lib/api/workspaces";
import { useI18n } from "@/i18n/LocaleProvider";
import { roleLabel } from "@/i18n/enumLabels";

type InviteMemberFormProps = {
  workspaceId: string;
  onCreated: (invitation: CreatedInvitation) => void;
};

export function InviteMemberForm({ workspaceId, onCreated }: InviteMemberFormProps) {
  const { dict } = useI18n();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitableRole>("Recruiter");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const invitation = await createInvitation(workspaceId, { email, role });
      setEmail("");
      onCreated(invitation);
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        setFormError(dict.common.apiUnavailable);
      } else if (error instanceof ApiError) {
        setFieldErrors(error.fieldErrors);
        setFormError(Object.keys(error.fieldErrors).length === 0 ? dict.errors.validation_error : null);
      } else {
        setFormError(dict.common.genericError);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex w-full max-w-sm flex-col gap-4">
      <AnimatedStatus id={formError}>
        <StatusBanner tone="danger" role="alert">
          {formError}
        </StatusBanner>
      </AnimatedStatus>

      <FormField
        id="inviteEmail"
        label={dict.invitations.fieldEmail}
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="off"
        disabled={isSubmitting}
        error={fieldErrors.Email?.[0]}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="inviteRole" className="text-sm font-medium text-text-primary">
          {dict.invitations.fieldRole}
        </label>
        <select
          id="inviteRole"
          value={role}
          onChange={(event) => setRole(event.target.value as InvitableRole)}
          disabled={isSubmitting}
          className="rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand-soft disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted"
        >
          <option value="Recruiter">{roleLabel(dict, "Recruiter")}</option>
          <option value="Interviewer">{roleLabel(dict, "Interviewer")}</option>
        </select>
      </div>

      <Button type="submit" variant="primary" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? dict.invitations.sendingInvitation : dict.invitations.sendInvitation}
      </Button>
    </form>
  );
}
