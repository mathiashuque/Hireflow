"use client";

import { motion } from "motion/react";
import type { CandidateStageCounts, JobCounts } from "@/lib/api/overview";
import { staggerContainer, staggerItem } from "@/lib/motion";

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
        <h2 className="text-sm font-semibold text-text-primary">Jobs</h2>
        <motion.dl
          initial="hidden"
          animate="show"
          variants={staggerContainer}
          className="mt-2 grid grid-cols-3 gap-3 sm:max-w-md"
        >
          {JOB_METRICS.map((metric) => (
            <motion.div
              key={metric.key}
              variants={staggerItem}
              className="rounded-lg border border-border bg-surface px-3 py-2.5"
            >
              <dt className="text-xs font-medium text-text-muted">{metric.label}</dt>
              <dd className="mt-1 text-xl font-semibold text-text-primary">{jobCounts[metric.key]}</dd>
            </motion.div>
          ))}
        </motion.dl>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-text-primary">Candidate pipeline · {totalCandidates} total</h2>
        <motion.dl
          initial="hidden"
          animate="show"
          variants={staggerContainer}
          className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5"
        >
          {STAGE_METRICS.map((metric) => (
            <motion.div
              key={metric.key}
              variants={staggerItem}
              className="rounded-lg border border-border bg-surface px-3 py-2.5"
            >
              <dt className="text-xs font-medium text-text-muted">{metric.label}</dt>
              <dd className="mt-1 text-xl font-semibold text-text-primary">{candidateCounts[metric.key]}</dd>
            </motion.div>
          ))}
        </motion.dl>
      </div>
    </div>
  );
}
