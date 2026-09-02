"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { OverviewActivity, OverviewActivityKind } from "@/lib/api/overview";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/i18n/LocaleProvider";
import { candidateStageLabel } from "@/i18n/enumLabels";

export function RecentActivityFeed({ workspaceId, activity }: { workspaceId: string; activity: OverviewActivity[] }) {
  const { dict } = useI18n();

  if (activity.length === 0) {
    return <EmptyState title={dict.workspaces.noRecentActivityTitle} description={dict.workspaces.noRecentActivityDescription} />;
  }

  return (
    <motion.ol
      initial="hidden"
      animate="show"
      variants={staggerContainer}
      className="relative flex flex-col gap-5 border-l border-border pl-7"
    >
      {activity.map((entry) => (
        <ActivityItem key={entry.id} workspaceId={workspaceId} entry={entry} />
      ))}
    </motion.ol>
  );
}

function ActivityItem({ workspaceId, entry }: { workspaceId: string; entry: OverviewActivity }) {
  const { dict, href, formatRelativeTime } = useI18n();

  return (
    <motion.li variants={staggerItem} className="relative">
      <span
        aria-hidden="true"
        className="absolute top-0.5 -left-[calc(1.75rem+1px)] flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-text-secondary"
      >
        <ActivityIcon kind={entry.kind} />
      </span>
      <p className="text-sm text-text-primary">{describe(dict, href, workspaceId, entry)}</p>
      <p className="mt-1 text-xs text-text-muted">
        {entry.actorDisplayName ?? dict.common.formerMember} · {formatRelativeTime(entry.occurredAt)}
      </p>
    </motion.li>
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

function describe(
  dict: ReturnType<typeof useI18n>["dict"],
  href: ReturnType<typeof useI18n>["href"],
  workspaceId: string,
  entry: OverviewActivity,
) {
  const jobLink = entry.jobId ? (
    <Link
      href={href(`/workspaces/${workspaceId}/jobs/${entry.jobId}/candidates`)}
      className="font-medium text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {entry.jobTitle}
    </Link>
  ) : null;

  const candidateLink = entry.candidateId ? (
    <Link
      href={href(`/workspaces/${workspaceId}/candidates/${entry.candidateId}`)}
      className="font-medium text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {entry.candidateName}
    </Link>
  ) : null;

  switch (entry.kind) {
    case "JobCreated":
      return dict.workspaces.activityJobCreated(jobLink);
    case "CandidateAdded":
      return dict.workspaces.activityCandidateAdded(candidateLink, jobLink);
    case "CandidateStageChanged":
      return dict.workspaces.activityCandidateStageChanged(
        candidateLink,
        <span className="font-medium">{entry.previousStage ? candidateStageLabel(dict, entry.previousStage) : ""}</span>,
        <span className="font-medium">{entry.newStage ? candidateStageLabel(dict, entry.newStage) : ""}</span>,
      );
    case "CandidateNoteAdded":
      return dict.workspaces.activityCandidateNoteAdded(candidateLink);
    default:
      return null;
  }
}
