"use client";

import type { CandidateStage } from "@/lib/api/candidates";
import { useI18n } from "@/i18n/LocaleProvider";
import { candidateStageLabel } from "@/i18n/enumLabels";

const STYLES: Record<CandidateStage, string> = {
  Applied: "bg-surface-muted text-text-secondary",
  Screening: "bg-sky-50 text-sky-700",
  Interview: "bg-brand-soft text-brand-strong",
  Offer: "bg-success-soft text-success-text",
  Rejected: "bg-danger-soft text-danger-text",
};

export function CandidateStageBadge({ stage }: { stage: CandidateStage }) {
  const { dict } = useI18n();
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[stage]}`}>
      {candidateStageLabel(dict, stage)}
    </span>
  );
}
