"use client";

import { useState } from "react";
import { CANDIDATE_NOTE_MAX_LENGTH } from "@/lib/api/candidates";

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
      {formError ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
        </p>
      ) : null}

      <label htmlFor="candidateNoteContent" className="text-sm font-medium text-slate-800">
        Add an internal note
      </label>
      <textarea
        id="candidateNoteContent"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        disabled={isSubmitting}
        rows={4}
        placeholder="Share interview feedback or recruiting context…"
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
      />

      <div className="flex items-center justify-between gap-3">
        <p className={`text-xs ${isOverLimit ? "text-red-600" : "text-slate-400"}`}>
          {content.length} / {CANDIDATE_NOTE_MAX_LENGTH}
        </p>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSubmitting ? "Adding…" : "Add note"}
        </button>
      </div>
    </form>
  );
}
