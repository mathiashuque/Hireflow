"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { AnimatedStatus, StatusBanner } from "@/components/ui/StatusBanner";
import { useI18n } from "@/i18n/LocaleProvider";

type CandidateDetailsFormProps = {
  initialName?: string;
  initialEmail?: string;
  submitLabel: string;
  submittingLabel: string;
  onSubmit: (input: { name: string; email: string }) => Promise<void>;
  onCancel?: () => void;
  /** Reports pending-submission state to a parent that needs to gate its own dismissal (e.g. a modal). */
  onSubmittingChange?: (isSubmitting: boolean) => void;
};

export function CandidateDetailsForm({
  initialName = "",
  initialEmail = "",
  submitLabel,
  submittingLabel,
  onSubmit,
  onCancel,
  onSubmittingChange,
}: CandidateDetailsFormProps) {
  const { dict } = useI18n();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateSubmitting(next: boolean) {
    setIsSubmitting(next);
    onSubmittingChange?.(next);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    updateSubmitting(true);

    try {
      await onSubmit({ name, email });
    } catch (error) {
      const message = error instanceof Error ? error.message : dict.common.genericError;
      setFormError(message);
    } finally {
      updateSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex w-full max-w-xl flex-col gap-4">
      <AnimatedStatus id={formError}>
        <StatusBanner tone="danger" role="alert">
          {formError}
        </StatusBanner>
      </AnimatedStatus>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="candidateName" className="text-sm font-medium text-text-primary">
          {dict.candidates.fieldName}
        </label>
        <input
          id="candidateName"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          disabled={isSubmitting}
          className="rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand-soft disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="candidateEmail" className="text-sm font-medium text-text-primary">
          {dict.candidates.fieldEmail}
        </label>
        <input
          id="candidateEmail"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          disabled={isSubmitting}
          className="rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand-soft disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? submittingLabel : submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            {dict.common.cancel}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
