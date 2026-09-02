import type { CandidateStageCounts, JobCounts } from "@/lib/api/overview";

const JOB_METRICS: { key: keyof JobCounts; label: string }[] = [
  { key: "open", label: "Open jobs" },
  { key: "draft", label: "Draft jobs" },
  { key: "closed", label: "Closed jobs" },
];

const STAGE_METRICS: { key: keyof CandidateStageCounts; label: string }[] = [
  { key: "applied", label: "Applied" },
  { key: "screening", label: "Screening" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
  { key: "rejected", label: "Rejected" },
];

export function OverviewMetricsCards({
  jobCounts,
  totalCandidates,
  candidateCounts,
}: {
  jobCounts: JobCounts;
  totalCandidates: number;
  candidateCounts: CandidateStageCounts;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-950">Jobs</h2>
        <dl className="mt-2 grid grid-cols-3 gap-3 sm:max-w-md">
          {JOB_METRICS.map((metric) => (
            <div key={metric.key} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <dt className="text-xs font-medium text-slate-500">{metric.label}</dt>
              <dd className="mt-1 text-xl font-semibold text-slate-950">{jobCounts[metric.key]}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-950">Candidate pipeline · {totalCandidates} total</h2>
        <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {STAGE_METRICS.map((metric) => (
            <div key={metric.key} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <dt className="text-xs font-medium text-slate-500">{metric.label}</dt>
              <dd className="mt-1 text-xl font-semibold text-slate-950">{candidateCounts[metric.key]}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
