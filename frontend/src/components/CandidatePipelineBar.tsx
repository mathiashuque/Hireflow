"use client";

import type { CandidateStageCounts } from "@/lib/api/overview";
import { useI18n } from "@/i18n/LocaleProvider";
import type { Dictionary } from "@/i18n/dictionaries";

function stageMeta(dict: Dictionary): {
  key: keyof CandidateStageCounts;
  label: string;
  barClass: string;
  dotClass: string;
}[] {
  return [
    { key: "applied", label: dict.statuses.candidateStage.Applied, barClass: "bg-slate-300", dotClass: "bg-slate-400" },
    { key: "screening", label: dict.statuses.candidateStage.Screening, barClass: "bg-sky-400", dotClass: "bg-sky-500" },
    { key: "interview", label: dict.statuses.candidateStage.Interview, barClass: "bg-indigo-400", dotClass: "bg-indigo-500" },
    { key: "offer", label: dict.statuses.candidateStage.Offer, barClass: "bg-emerald-400", dotClass: "bg-emerald-500" },
    { key: "rejected", label: dict.statuses.candidateStage.Rejected, barClass: "bg-red-300", dotClass: "bg-red-400" },
  ];
}

type CandidatePipelineBarProps = {
  total: number;
  counts: CandidateStageCounts;
  size?: "md" | "sm";
};

/**
 * A segmented, proportional candidate-pipeline visualization plus a semantic legend of
 * exact counts. The bar itself is decorative (aria-hidden); the legend list is the
 * accessible, color-independent source of truth and remains meaningful on its own.
 * Guards the zero-total case explicitly rather than producing NaN/misleading widths.
 */
export function CandidatePipelineBar({ total, counts, size = "md" }: CandidatePipelineBarProps) {
  const { dict } = useI18n();
  const meta = stageMeta(dict);
  const barHeight = size === "md" ? "h-2.5" : "h-1.5";
  const legendTextSize = size === "md" ? "text-xs" : "text-[11px]";
  const legendGap = size === "md" ? "gap-x-4 gap-y-1.5" : "gap-x-3 gap-y-1";

  return (
    <div>
      <div aria-hidden="true" className={`flex w-full overflow-hidden rounded-full bg-surface-muted ${barHeight}`}>
        {total > 0
          ? meta.map((item) => {
              const value = counts[item.key];
              if (value <= 0) {
                return null;
              }
              const width = (value / total) * 100;
              return <div key={item.key} className={item.barClass} style={{ width: `${width}%` }} />;
            })
          : null}
      </div>

      {size === "md" && total === 0 ? (
        <p className="mt-2 text-xs text-text-muted">{dict.workspaces.noCandidatesInPipeline}</p>
      ) : null}

      <ul className={`mt-2 flex flex-wrap ${legendGap} ${legendTextSize} text-text-secondary`}>
        {meta.map((item) => (
          <li key={item.key} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${item.dotClass}`} />
            <span>
              {item.label}: <span className="font-medium text-text-primary">{counts[item.key]}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
