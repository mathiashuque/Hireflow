import type { JobStatus } from "@/lib/api/jobs";

const STYLES: Record<JobStatus, string> = {
  Draft: "bg-surface-muted text-text-secondary",
  Open: "bg-success-soft text-success-text",
  Closed: "bg-surface-muted text-text-muted",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {status}
    </span>
  );
}
