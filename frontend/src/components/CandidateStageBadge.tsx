import type { CandidateStage } from "@/lib/api/candidates";

const STYLES: Record<CandidateStage, string> = {
  Applied: "bg-surface-muted text-text-secondary",
  Screening: "bg-sky-50 text-sky-700",
  Interview: "bg-brand-soft text-brand-strong",
  Offer: "bg-success-soft text-success-text",
  Rejected: "bg-danger-soft text-danger-text",
};

export function CandidateStageBadge({ stage }: { stage: CandidateStage }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[stage]}`}>
      {stage}
    </span>
  );
}
