"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { JobWorkload } from "@/lib/api/overview";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import { CandidatePipelineBar } from "@/components/CandidatePipelineBar";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/i18n/LocaleProvider";

export function JobWorkloadList({ workspaceId, workload }: { workspaceId: string; workload: JobWorkload[] }) {
  const { dict, href, formatRelativeTime } = useI18n();

  if (workload.length === 0) {
    return (
      <EmptyState
        title={dict.workspaces.noActiveJobsTitle}
        description={dict.workspaces.noActiveJobsDescription}
        action={
          <Link
            href={href(`/workspaces/${workspaceId}/jobs`)}
            className="text-sm font-medium text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {dict.workspaces.viewJobs}
          </Link>
        }
      />
    );
  }

  return (
    <motion.ul initial="hidden" animate="show" variants={staggerContainer} className="flex flex-col gap-3">
      {workload.map((job) => (
        <motion.li
          key={job.jobId}
          variants={staggerItem}
          className="rounded-lg border border-border bg-surface p-4 transition hover:border-brand/30 hover:shadow-[var(--shadow-card-hover)]"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <JobStatusBadge status={job.status} />
              <Link
                href={href(`/workspaces/${workspaceId}/jobs/${job.jobId}/candidates`)}
                className="break-words text-sm font-medium text-text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {job.title}
              </Link>
            </div>
            <p className="mt-1 text-xs text-text-muted">
              {dict.workspaces.updated(formatRelativeTime(job.updatedAt))} · {dict.workspaces.candidateCount(job.totalCandidates)}
            </p>
          </div>

          <div className="mt-4">
            <CandidatePipelineBar total={job.totalCandidates} counts={job.stageCounts} size="sm" />
          </div>
        </motion.li>
      ))}
    </motion.ul>
  );
}
