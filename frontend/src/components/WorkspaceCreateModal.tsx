"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { WorkspaceCreateForm } from "@/components/WorkspaceCreateForm";
import type { WorkspaceDetail } from "@/lib/api/workspaces";
import { useI18n } from "@/i18n/LocaleProvider";

type WorkspaceCreateModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (workspace: WorkspaceDetail) => void;
};

/** Wraps the existing workspace-creation form/API/error behavior in an accessible dialog. */
export function WorkspaceCreateModal({ open, onClose, onCreated }: WorkspaceCreateModalProps) {
  const { dict } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={dict.dashboard.createWorkspaceModalTitle}
      description={dict.dashboard.createWorkspaceModalDescription}
      preventClose={isSubmitting}
    >
      <WorkspaceCreateForm onCreated={onCreated} onSubmittingChange={setIsSubmitting} />
    </Dialog>
  );
}
