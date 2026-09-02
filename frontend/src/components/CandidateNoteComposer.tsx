"use client";

import { useState } from "react";
import { CANDIDATE_NOTE_MAX_LENGTH } from "@/lib/api/candidates";
import { Button } from "@/components/ui/Button";
import { AnimatedStatus, StatusBanner } from "@/components/ui/StatusBanner";
import { useI18n } from "@/i18n/LocaleProvider";

type CandidateNoteComposerProps = {
  onSubmit: (content: string) => Promise<void>;
};

export function CandidateNoteComposer({ onSubmit }: CandidateNoteComposerProps) {
  const { dict } = useI18n();
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
      setFormError(dict.candidates.noteBlank);
      return;
    }
    if (isOverLimit) {
      setFormError(dict.candidates.noteTooLong(CANDIDATE_NOTE_MAX_LENGTH));
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(content);
      setContent("");
    } catch (error) {
      const message = error instanceof Error ? error.message : dict.common.genericError;
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
        {dict.candidates.addNoteLabel}
      </label>
      <textarea
        id="candidateNoteContent"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        disabled={isSubmitting}
        rows={4}
        placeholder={dict.candidates.addNotePlaceholder}
        className="rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand-soft disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted"
      />

      <div className="flex items-center justify-between gap-3">
        <p className={`text-xs ${isOverLimit ? "text-danger-text" : "text-text-muted"}`}>
          {dict.candidates.noteCharCount(content.length, CANDIDATE_NOTE_MAX_LENGTH)}
        </p>
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? dict.candidates.addingNote : dict.candidates.addNote}
        </Button>
      </div>
    </form>
  );
}
