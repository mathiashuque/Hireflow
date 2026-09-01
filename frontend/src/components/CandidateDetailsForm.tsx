"use client";

import { useState } from "react";

type CandidateDetailsFormProps = {
  initialName?: string;
  initialEmail?: string;
  submitLabel: string;
  submittingLabel: string;
  onSubmit: (input: { name: string; email: string }) => Promise<void>;
  onCancel?: () => void;
};

export function CandidateDetailsForm({
  initialName = "",
  initialEmail = "",
  submitLabel,
  submittingLabel,
  onSubmit,
  onCancel,
}: CandidateDetailsFormProps) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      await onSubmit({ name, email });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex w-full max-w-xl flex-col gap-4">
      {formError ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="candidateName" className="text-sm font-medium text-slate-800">
          Name
        </label>
        <input
          id="candidateName"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          disabled={isSubmitting}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="candidateEmail" className="text-sm font-medium text-slate-800">
          Email
        </label>
        <input
          id="candidateEmail"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          disabled={isSubmitting}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSubmitting ? submittingLabel : submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
