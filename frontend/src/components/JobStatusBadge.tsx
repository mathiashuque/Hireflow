import type { JobStatus } from "@/lib/api/jobs";

const STYLES: Record<JobStatus, string> = {
  Draft: "bg-slate-100 text-slate-700",
  Open: "bg-emerald-50 text-emerald-700",
  Closed: "bg-slate-100 text-slate-500",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {status}
    </span>
  );
}
