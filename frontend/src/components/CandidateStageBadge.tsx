import type { CandidateStage } from "@/lib/api/candidates";

const STYLES: Record<CandidateStage, string> = {
  Applied: "bg-slate-100 text-slate-700",
  Screening: "bg-sky-50 text-sky-700",
  Interview: "bg-indigo-50 text-indigo-700",
  Offer: "bg-emerald-50 text-emerald-700",
  Rejected: "bg-red-50 text-red-700",
};

export function CandidateStageBadge({ stage }: { stage: CandidateStage }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[stage]}`}>
      {stage}
    </span>
  );
}
