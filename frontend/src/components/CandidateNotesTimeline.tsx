"use client";

import { motion } from "motion/react";
import type { CandidateNote } from "@/lib/api/candidates";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/i18n/LocaleProvider";

export function CandidateNotesTimeline({ notes }: { notes: CandidateNote[] }) {
  const { dict, formatDateTime } = useI18n();

  if (notes.length === 0) {
    return <EmptyState title={dict.candidates.noNotes} />;
  }

  return (
    <motion.ol initial="hidden" animate="show" variants={staggerContainer} className="flex flex-col gap-3">
      {notes.map((note) => (
        <motion.li
          key={note.id}
          layout
          variants={staggerItem}
          className="rounded-lg border border-border bg-surface px-4 py-3"
        >
          <p className="whitespace-pre-wrap text-sm text-text-primary">{note.content}</p>
          <p className="mt-2 text-xs text-text-muted">
            {note.authorDisplayName ?? dict.common.formerMember} · {formatDateTime(note.createdAt)}
          </p>
        </motion.li>
      ))}
    </motion.ol>
  );
}
