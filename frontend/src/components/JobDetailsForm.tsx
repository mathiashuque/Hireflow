"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { AnimatedStatus, StatusBanner } from "@/components/ui/StatusBanner";

type JobDetailsFormProps = {
  initialTitle?: string;
  initialDescription?: string;
  submitLabel: string;
  submittingLabel: string;
  onSubmit: (input: { title: string; description: string }) => Promise<void>;
  onCancel?: () => void;
};

export function JobDetailsForm({
  initialTitle = "",
  initialDescription = "",
  submitLabel,
  submittingLabel,
  onSubmit,
  onCancel,
}: JobDetailsFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setTitleError(null);
    setIsSubmitting(true);

    try {
      await onSubmit({ title, description });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
      setFormError(message);
    } finally {
      setIsSubmitting(false);
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
        <label htmlFor="jobTitle" className="text-sm font-medium text-text-primary">
          Title
        </label>
        <input
          id="jobTitle"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          disabled={isSubmitting}
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? "jobTitle-error" : undefined}
          className="rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand-soft disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted"
        />
        {titleError ? (
          <p id="jobTitle-error" role="alert" className="text-sm text-danger-text">
            {titleError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="jobDescription" className="text-sm font-medium text-text-primary">
          Description <span className="font-normal text-text-muted">(optional)</span>
        </label>
        <textarea
          id="jobDescription"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={isSubmitting}
          rows={6}
          className="rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand-soft disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? submittingLabel : submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
