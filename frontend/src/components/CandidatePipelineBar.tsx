import type { CandidateStageCounts } from "@/lib/api/overview";

const STAGE_META: {
  key: keyof CandidateStageCounts;
  label: string;
  barClass: string;
  dotClass: string;
}[] = [
  { key: "applied", label: "Applied", barClass: "bg-slate-300", dotClass: "bg-slate-400" },
  { key: "screening", label: "Screening", barClass: "bg-sky-400", dotClass: "bg-sky-500" },
  { key: "interview", label: "Interview", barClass: "bg-indigo-400", dotClass: "bg-indigo-500" },
  { key: "offer", label: "Offer", barClass: "bg-emerald-400", dotClass: "bg-emerald-500" },
  { key: "rejected", label: "Rejected", barClass: "bg-red-300", dotClass: "bg-red-400" },
];

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
  const barHeight = size === "md" ? "h-2.5" : "h-1.5";
  const legendTextSize = size === "md" ? "text-xs" : "text-[11px]";
  const legendGap = size === "md" ? "gap-x-4 gap-y-1.5" : "gap-x-3 gap-y-1";

  return (
    <div>
      <div aria-hidden="true" className={`flex w-full overflow-hidden rounded-full bg-surface-muted ${barHeight}`}>
        {total > 0
          ? STAGE_META.map((meta) => {
              const value = counts[meta.key];
              if (value <= 0) {
                return null;
              }
              const width = (value / total) * 100;
              return <div key={meta.key} className={meta.barClass} style={{ width: `${width}%` }} />;
            })
          : null}
      </div>

      {size === "md" && total === 0 ? (
        <p className="mt-2 text-xs text-text-muted">No candidates in the pipeline yet.</p>
      ) : null}

      <ul className={`mt-2 flex flex-wrap ${legendGap} ${legendTextSize} text-text-secondary`}>
        {STAGE_META.map((meta) => (
          <li key={meta.key} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${meta.dotClass}`} />
            <span>
              {meta.label}: <span className="font-medium text-text-primary">{counts[meta.key]}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
