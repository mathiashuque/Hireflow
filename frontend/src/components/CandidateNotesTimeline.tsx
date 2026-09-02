"use client";

import { motion } from "motion/react";
import type { CandidateNote } from "@/lib/api/candidates";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { EmptyState } from "@/components/ui/EmptyState";

export function CandidateNotesTimeline({ notes }: { notes: CandidateNote[] }) {
  if (notes.length === 0) {
    return <EmptyState title="No internal notes yet" />;
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
            {note.authorDisplayName ?? "A former member"} · {new Date(note.createdAt).toLocaleString()}
          </p>
        </motion.li>
      ))}
    </motion.ol>
  );
}
