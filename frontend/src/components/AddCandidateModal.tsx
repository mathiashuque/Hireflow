"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { CandidateDetailsForm } from "@/components/CandidateDetailsForm";
import { ApiError, ApiUnavailableError } from "@/lib/api/client";
import { createCandidate, isDuplicateEmailConflict, isJobNotOpenConflict } from "@/lib/api/candidates";

type AddCandidateModalProps = {
  open: boolean;
  workspaceId: string;
  jobId: string;
  onClose: () => void;
  onAdded: () => void;
};

/** Wraps the existing add-candidate form/API/error behavior in an accessible dialog. */
export function AddCandidateModal({ open, workspaceId, jobId, onClose, onAdded }: AddCandidateModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add candidate"
      description="New candidates start in the Applied stage."
      preventClose={isSubmitting}
    >
      <CandidateDetailsForm
        submitLabel="Add candidate"
        submittingLabel="Adding…"
        onCancel={onClose}
        onSubmittingChange={setIsSubmitting}
        onSubmit={async ({ name, email }) => {
          try {
            await createCandidate(workspaceId, jobId, { name, email });
            onAdded();
          } catch (error) {
            if (error instanceof ApiUnavailableError) {
              throw error;
            }
            if (isJobNotOpenConflict(error)) {
              throw new Error("This job is no longer open. Refresh the page to see its current status.");
            }
            if (isDuplicateEmailConflict(error)) {
              throw new Error("A candidate with this email already exists for this job.");
            }
            if (error instanceof ApiError) {
              throw new Error(error.fieldErrors.Name?.[0] ?? error.message);
            }
            throw new Error("Something went wrong. Please try again.");
          }
        }}
      />
    </Dialog>
  );
}
