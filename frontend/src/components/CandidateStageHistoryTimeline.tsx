"use client";

import { motion } from "motion/react";
import type { CandidateStageHistoryEntry } from "@/lib/api/candidates";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/i18n/LocaleProvider";
import { candidateStageLabel } from "@/i18n/enumLabels";

export function CandidateStageHistoryTimeline({ history }: { history: CandidateStageHistoryEntry[] }) {
  const { dict, formatDateTime } = useI18n();

  if (history.length === 0) {
    return <EmptyState title={dict.candidates.noStageChanges} />;
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
            <span className="font-medium">{candidateStageLabel(dict, entry.previousStage)}</span>
            {" → "}
            <span className="font-medium">{candidateStageLabel(dict, entry.newStage)}</span>
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {entry.changedByDisplayName ?? dict.common.formerMember} · {formatDateTime(entry.changedAt)}
          </p>
        </motion.li>
      ))}
    </motion.ol>
  );
}
