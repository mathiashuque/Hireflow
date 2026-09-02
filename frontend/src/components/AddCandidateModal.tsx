"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { CandidateDetailsForm } from "@/components/CandidateDetailsForm";
import { ApiError, ApiUnavailableError } from "@/lib/api/client";
import { createCandidate, isDuplicateEmailConflict, isJobNotOpenConflict } from "@/lib/api/candidates";
import { useI18n } from "@/i18n/LocaleProvider";

type AddCandidateModalProps = {
  open: boolean;
  workspaceId: string;
  jobId: string;
  onClose: () => void;
  onAdded: () => void;
};

/** Wraps the existing add-candidate form/API/error behavior in an accessible dialog. */
export function AddCandidateModal({ open, workspaceId, jobId, onClose, onAdded }: AddCandidateModalProps) {
  const { dict } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={dict.candidates.addCandidateModalTitle}
      description={dict.candidates.addCandidateModalDescription}
      preventClose={isSubmitting}
    >
      <CandidateDetailsForm
        submitLabel={dict.candidates.addCandidateSubmit}
        submittingLabel={dict.candidates.addCandidateSubmitting}
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
              throw new Error(dict.candidates.jobNotOpen);
            }
            if (isDuplicateEmailConflict(error)) {
              throw new Error(dict.candidates.duplicateEmail);
            }
            if (error instanceof ApiError) {
              throw new Error(error.fieldErrors.Name?.[0] ?? dict.errors.validation_error);
            }
            throw new Error(dict.common.genericError);
          }
        }}
      />
    </Dialog>
  );
}
