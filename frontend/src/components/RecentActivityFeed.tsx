"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { OverviewActivity } from "@/lib/api/overview";
import { formatRelativeTime } from "@/lib/relativeTime";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { EmptyState } from "@/components/ui/EmptyState";

export function RecentActivityFeed({ workspaceId, activity }: { workspaceId: string; activity: OverviewActivity[] }) {
  if (activity.length === 0) {
    return <EmptyState title="No recent activity yet" />;
  }

  return (
    <motion.ol initial="hidden" animate="show" variants={staggerContainer} className="flex flex-col gap-3">
      {activity.map((entry) => (
        <motion.li
          key={entry.id}
          variants={staggerItem}
          className="rounded-lg border border-border bg-surface px-4 py-3"
        >
          <p className="text-sm text-text-primary">{describe(workspaceId, entry)}</p>
          <p className="mt-1 text-xs text-text-muted">
            {entry.actorDisplayName ?? "A former member"} · {formatRelativeTime(entry.occurredAt)}
          </p>
        </motion.li>
      ))}
    </motion.ol>
  );
}

function describe(workspaceId: string, entry: OverviewActivity) {
  const jobLink = entry.jobId ? (
    <Link
      href={`/workspaces/${workspaceId}/jobs/${entry.jobId}/candidates`}
      className="font-medium text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {entry.jobTitle}
    </Link>
  ) : null;

  const candidateLink = entry.candidateId ? (
    <Link
      href={`/workspaces/${workspaceId}/candidates/${entry.candidateId}`}
      className="font-medium text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {entry.candidateName}
    </Link>
  ) : null;

  switch (entry.kind) {
    case "JobCreated":
      return <>Created job {jobLink}</>;
    case "CandidateAdded":
      return (
        <>
          Added {candidateLink} to {jobLink}
        </>
      );
    case "CandidateStageChanged":
      return (
        <>
          Moved {candidateLink} from <span className="font-medium">{entry.previousStage}</span> to{" "}
          <span className="font-medium">{entry.newStage}</span>
        </>
      );
    case "CandidateNoteAdded":
      return <>Added a note on {candidateLink}</>;
    default:
      return null;
  }
}
