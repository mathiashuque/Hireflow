"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { JobWorkload } from "@/lib/api/overview";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import { formatRelativeTime } from "@/lib/relativeTime";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { EmptyState } from "@/components/ui/EmptyState";

export function JobWorkloadList({ workspaceId, workload }: { workspaceId: string; workload: JobWorkload[] }) {
  if (workload.length === 0) {
    return <EmptyState title="No active jobs yet" />;
  }

  return (
    <motion.ul initial="hidden" animate="show" variants={staggerContainer} className="flex flex-col gap-3">
      {workload.map((job) => (
        <motion.li
          key={job.jobId}
          variants={staggerItem}
          className="rounded-lg border border-border bg-surface px-4 py-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <JobStatusBadge status={job.status} />
                <Link
                  href={`/workspaces/${workspaceId}/jobs/${job.jobId}/candidates`}
                  className="text-sm font-medium text-text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {job.title}
                </Link>
              </div>
              <p className="mt-1 text-xs text-text-muted">
                Updated {formatRelativeTime(job.updatedAt)} · {job.totalCandidates} candidate{job.totalCandidates === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
            <StageCount label="Applied" value={job.stageCounts.applied} />
            <StageCount label="Screening" value={job.stageCounts.screening} />
            <StageCount label="Interview" value={job.stageCounts.interview} />
            <StageCount label="Offer" value={job.stageCounts.offer} />
            <StageCount label="Rejected" value={job.stageCounts.rejected} />
          </dl>
        </motion.li>
      ))}
    </motion.ul>
  );
}

function StageCount({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="inline font-medium">{label}</dt> <dd className="inline">{value}</dd>
    </div>
  );
}
