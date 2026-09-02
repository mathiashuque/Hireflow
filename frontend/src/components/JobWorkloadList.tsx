import Link from "next/link";
import type { JobWorkload } from "@/lib/api/overview";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import { formatRelativeTime } from "@/lib/relativeTime";

export function JobWorkloadList({ workspaceId, workload }: { workspaceId: string; workload: JobWorkload[] }) {
  if (workload.length === 0) {
    return <p className="text-sm text-slate-500">No active jobs yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {workload.map((job) => (
        <li key={job.jobId} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <JobStatusBadge status={job.status} />
                <Link
                  href={`/workspaces/${workspaceId}/jobs/${job.jobId}/candidates`}
                  className="text-sm font-medium text-slate-950 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                >
                  {job.title}
                </Link>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Updated {formatRelativeTime(job.updatedAt)} · {job.totalCandidates} candidate{job.totalCandidates === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            <StageCount label="Applied" value={job.stageCounts.applied} />
            <StageCount label="Screening" value={job.stageCounts.screening} />
            <StageCount label="Interview" value={job.stageCounts.interview} />
            <StageCount label="Offer" value={job.stageCounts.offer} />
            <StageCount label="Rejected" value={job.stageCounts.rejected} />
          </dl>
        </li>
      ))}
    </ul>
  );
}

function StageCount({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="inline font-medium">{label}</dt> <dd className="inline">{value}</dd>
    </div>
  );
}
