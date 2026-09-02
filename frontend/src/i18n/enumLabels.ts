import type { WorkspaceRole } from "@/lib/api/workspaces";
import type { JobStatus } from "@/lib/api/jobs";
import type { CandidateStage } from "@/lib/api/candidates";
import type { Dictionary } from "./dictionaries";

/**
 * Translated *display* labels for protocol enum values. The protocol values
 * themselves (role/status/stage strings sent to and compared against the
 * API) must never change — only what is rendered to the user.
 */
export function roleLabel(dict: Dictionary, role: WorkspaceRole): string {
  return dict.statuses.role[role];
}

export function jobStatusLabel(dict: Dictionary, status: JobStatus): string {
  return dict.statuses.jobStatus[status];
}

export function candidateStageLabel(dict: Dictionary, stage: CandidateStage): string {
  return dict.statuses.candidateStage[stage];
}
