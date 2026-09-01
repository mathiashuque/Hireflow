"use client";

import { useState } from "react";
import { FormField } from "@/components/FormField";
import { ApiError, ApiUnavailableError } from "@/lib/api/client";
import { createWorkspace, type WorkspaceDetail } from "@/lib/api/workspaces";

type WorkspaceCreateFormProps = {
  onCreated: (workspace: WorkspaceDetail) => void;
};

export function WorkspaceCreateForm({ onCreated }: WorkspaceCreateFormProps) {
  const [name, setName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const workspace = await createWorkspace({ name });
      setName("");
      onCreated(workspace);
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        setFormError(error.message);
      } else if (error instanceof ApiError) {
        setFieldErrors(error.fieldErrors);
        setFormError(Object.keys(error.fieldErrors).length === 0 ? error.message : null);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex w-full max-w-sm flex-col gap-4">
      {formError ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
        </p>
      ) : null}

      <FormField
        id="workspaceName"
        label="Workspace name"
        type="text"
        value={name}
        onChange={setName}
        autoComplete="off"
        disabled={isSubmitting}
        error={fieldErrors.Name?.[0]}
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {isSubmitting ? "Creating workspace…" : "Create workspace"}
      </button>
    </form>
  );
}
