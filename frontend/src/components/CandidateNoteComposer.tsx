"use client";

import { useState } from "react";
import { CANDIDATE_NOTE_MAX_LENGTH } from "@/lib/api/candidates";
import { Button } from "@/components/ui/Button";
import { AnimatedStatus, StatusBanner } from "@/components/ui/StatusBanner";

type CandidateNoteComposerProps = {
  onSubmit: (content: string) => Promise<void>;
};

export function CandidateNoteComposer({ onSubmit }: CandidateNoteComposerProps) {
  const [content, setContent] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmedLength = content.trim().length;
  const isOverLimit = content.length > CANDIDATE_NOTE_MAX_LENGTH;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    if (trimmedLength === 0) {
      setFormError("Note content can't be blank.");
      return;
    }
    if (isOverLimit) {
      setFormError(`Note content must be at most ${CANDIDATE_NOTE_MAX_LENGTH} characters.`);
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(content);
      setContent("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex w-full max-w-xl flex-col gap-2">
      <AnimatedStatus id={formError}>
        <StatusBanner tone="danger" role="alert">
          {formError}
        </StatusBanner>
      </AnimatedStatus>

      <label htmlFor="candidateNoteContent" className="text-sm font-medium text-text-primary">
        Add an internal note
      </label>
      <textarea
        id="candidateNoteContent"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        disabled={isSubmitting}
        rows={4}
        placeholder="Share interview feedback or recruiting context…"
        className="rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand-soft disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted"
      />

      <div className="flex items-center justify-between gap-3">
        <p className={`text-xs ${isOverLimit ? "text-danger-text" : "text-text-muted"}`}>
          {content.length} / {CANDIDATE_NOTE_MAX_LENGTH}
        </p>
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Adding…" : "Add note"}
        </Button>
      </div>
    </form>
  );
}
