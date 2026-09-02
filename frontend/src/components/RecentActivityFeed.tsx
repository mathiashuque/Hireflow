"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { OverviewActivity, OverviewActivityKind } from "@/lib/api/overview";
import { formatRelativeTime } from "@/lib/relativeTime";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { EmptyState } from "@/components/ui/EmptyState";

export function RecentActivityFeed({ workspaceId, activity }: { workspaceId: string; activity: OverviewActivity[] }) {
  if (activity.length === 0) {
    return <EmptyState title="No recent activity yet" description="Job and candidate updates in this workspace will show up here." />;
  }

  return (
    <motion.ol
      initial="hidden"
      animate="show"
      variants={staggerContainer}
      className="relative flex flex-col gap-5 border-l border-border pl-7"
    >
      {activity.map((entry) => (
        <motion.li key={entry.id} variants={staggerItem} className="relative">
          <span
            aria-hidden="true"
            className="absolute top-0.5 -left-[calc(1.75rem+1px)] flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-text-secondary"
          >
            <ActivityIcon kind={entry.kind} />
          </span>
          <p className="text-sm text-text-primary">{describe(workspaceId, entry)}</p>
          <p className="mt-1 text-xs text-text-muted">
            {entry.actorDisplayName ?? "A former member"} · {formatRelativeTime(entry.occurredAt)}
          </p>
        </motion.li>
      ))}
    </motion.ol>
  );
}

function ActivityIcon({ kind }: { kind: OverviewActivityKind }) {
  const common = {
    width: 13,
    height: 13,
    viewBox: "0 0 16 16",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (kind) {
    case "JobCreated":
      return (
        <svg {...common}>
          <rect x="2.5" y="5" width="11" height="8" rx="1.4" />
          <path d="M5.5 5V4a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 10.5 4v1" />
        </svg>
      );
    case "CandidateAdded":
      return (
        <svg {...common}>
          <circle cx="6.2" cy="5.5" r="2.2" />
          <path d="M2.5 13c0-2.3 1.9-3.8 3.7-3.8s3.7 1.5 3.7 3.8" />
          <path d="M12 5v4M14 7h-4" />
        </svg>
      );
    case "CandidateStageChanged":
      return (
        <svg {...common}>
          <path d="M3 8h9" />
          <path d="M9 4.5 12.5 8 9 11.5" />
        </svg>
      );
    case "CandidateNoteAdded":
      return (
        <svg {...common}>
          <path d="M4 2.8h6.2L13 5.6V13a.7.7 0 0 1-.7.7H4a.7.7 0 0 1-.7-.7V3.5A.7.7 0 0 1 4 2.8Z" />
          <path d="M6 7.2h4M6 9.6h4" />
        </svg>
      );
    default:
      return null;
  }
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
