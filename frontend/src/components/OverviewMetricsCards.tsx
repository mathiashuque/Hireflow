"use client";

import { motion } from "motion/react";
import type { CandidateStageCounts, JobCounts } from "@/lib/api/overview";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { Card } from "@/components/ui/Card";
import { CandidatePipelineBar } from "@/components/CandidatePipelineBar";

const KPIS: { key: "total" | keyof JobCounts; label: string; dotClass: string }[] = [
  { key: "total", label: "Total candidates", dotClass: "bg-brand" },
  { key: "open", label: "Open jobs", dotClass: "bg-emerald-500" },
  { key: "draft", label: "Draft jobs", dotClass: "bg-slate-400" },
  { key: "closed", label: "Closed jobs", dotClass: "bg-slate-400" },
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
    <section aria-labelledby="workspace-summary-heading">
      <h2 id="workspace-summary-heading" className="text-sm font-semibold text-text-primary">
        Workspace summary
      </h2>

      <Card className="mt-3 p-5 sm:p-6">
        <motion.dl
          initial="hidden"
          animate="show"
          variants={staggerContainer}
          className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4"
        >
          {KPIS.map((kpi) => (
            <motion.div key={kpi.key} variants={staggerItem}>
              <dt className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
                <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${kpi.dotClass}`} />
                {kpi.label}
              </dt>
              <dd className="mt-1.5 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
                {kpi.key === "total" ? totalCandidates : jobCounts[kpi.key]}
              </dd>
            </motion.div>
          ))}
        </motion.dl>

        <div className="my-5 border-t border-border" aria-hidden="true" />

        <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-text-muted">Candidate pipeline</h3>
        <div className="mt-3">
          <CandidatePipelineBar total={totalCandidates} counts={candidateCounts} size="md" />
        </div>
      </Card>
    </section>
  );
}
