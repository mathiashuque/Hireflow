"use client";

import type { JobStatus } from "@/lib/api/jobs";
import { useI18n } from "@/i18n/LocaleProvider";
import { jobStatusLabel } from "@/i18n/enumLabels";

const STYLES: Record<JobStatus, string> = {
  Draft: "bg-surface-muted text-text-secondary",
  Open: "bg-success-soft text-success-text",
  Closed: "bg-surface-muted text-text-muted",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const { dict } = useI18n();
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {jobStatusLabel(dict, status)}
    </span>
  );
}
