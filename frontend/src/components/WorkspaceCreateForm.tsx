"use client";

import { useState } from "react";
import { FormField } from "@/components/FormField";
import { Button } from "@/components/ui/Button";
import { AnimatedStatus, StatusBanner } from "@/components/ui/StatusBanner";
import { ApiError, ApiUnavailableError } from "@/lib/api/client";
import { createWorkspace, type WorkspaceDetail } from "@/lib/api/workspaces";
import { useI18n } from "@/i18n/LocaleProvider";

type WorkspaceCreateFormProps = {
  onCreated: (workspace: WorkspaceDetail) => void;
  /** Reports pending-submission state to a parent that needs to gate its own dismissal (e.g. a modal). */
  onSubmittingChange?: (isSubmitting: boolean) => void;
};

export function WorkspaceCreateForm({ onCreated, onSubmittingChange }: WorkspaceCreateFormProps) {
  const { dict } = useI18n();
  const [name, setName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateSubmitting(next: boolean) {
    setIsSubmitting(next);
    onSubmittingChange?.(next);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    updateSubmitting(true);

    try {
      const workspace = await createWorkspace({ name });
      setName("");
      onCreated(workspace);
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
      updateSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex w-full flex-col gap-4">
      <AnimatedStatus id={formError}>
        <StatusBanner tone="danger" role="alert">
          {formError}
        </StatusBanner>
      </AnimatedStatus>

      <FormField
        id="workspaceName"
        label={dict.dashboard.workspaceNameLabel}
        type="text"
        value={name}
        onChange={setName}
        autoComplete="off"
        disabled={isSubmitting}
        error={fieldErrors.Name?.[0]}
      />

      <Button type="submit" variant="primary" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? dict.dashboard.creatingWorkspace : dict.dashboard.createWorkspace}
      </Button>
    </form>
  );
}
