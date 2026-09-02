"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { WorkspaceCreateForm } from "@/components/WorkspaceCreateForm";
import type { WorkspaceDetail } from "@/lib/api/workspaces";

type WorkspaceCreateModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (workspace: WorkspaceDetail) => void;
};

/** Wraps the existing workspace-creation form/API/error behavior in an accessible dialog. */
export function WorkspaceCreateModal({ open, onClose, onCreated }: WorkspaceCreateModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create a workspace"
      description="A workspace is where your team's job openings, candidates, and hiring activity live."
      preventClose={isSubmitting}
    >
      <WorkspaceCreateForm onCreated={onCreated} onSubmittingChange={setIsSubmitting} />
    </Dialog>
  );
}
