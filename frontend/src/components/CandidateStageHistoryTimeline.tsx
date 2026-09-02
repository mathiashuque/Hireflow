"use client";

import { motion } from "motion/react";
import type { CandidateStageHistoryEntry } from "@/lib/api/candidates";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { EmptyState } from "@/components/ui/EmptyState";

export function CandidateStageHistoryTimeline({ history }: { history: CandidateStageHistoryEntry[] }) {
  if (history.length === 0) {
    return <EmptyState title="No stage changes yet" />;
  }

  return (
    <motion.ol initial="hidden" animate="show" variants={staggerContainer} className="flex flex-col gap-3">
      {history.map((entry) => (
        <motion.li
          key={entry.id}
          variants={staggerItem}
          className="rounded-lg border border-border bg-surface px-4 py-3"
        >
          <p className="text-sm text-text-primary">
            <span className="font-medium">{entry.previousStage}</span>
            {" → "}
            <span className="font-medium">{entry.newStage}</span>
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {entry.changedByDisplayName ?? "A former member"} · {new Date(entry.changedAt).toLocaleString()}
          </p>
        </motion.li>
      ))}
    </motion.ol>
  );
}
