import { ApiError, apiRequest } from "./client";
import type { CandidateStage } from "./candidates";
import type { JobStatus } from "./jobs";

export type JobCounts = {
  draft: number;
  open: number;
  closed: number;
};

export type CandidateStageCounts = {
  applied: number;
  screening: number;
  interview: number;
  offer: number;
  rejected: number;
};

export type JobWorkload = {
  jobId: string;
  title: string;
  status: JobStatus;
  updatedAt: string;
  totalCandidates: number;
  stageCounts: CandidateStageCounts;
};

export type OverviewActivityKind = "JobCreated" | "CandidateAdded" | "CandidateStageChanged" | "CandidateNoteAdded";

export type OverviewActivity = {
  id: string;
  kind: OverviewActivityKind;
  occurredAt: string;
  actorUserId: string;
  /** Present only when the actor's account could still be resolved. */
  actorDisplayName: string | null;
  jobId: string | null;
  jobTitle: string | null;
  candidateId: string | null;
  candidateName: string | null;
  previousStage: CandidateStage | null;
  newStage: CandidateStage | null;
};

export type WorkspaceOverview = {
  workspaceId: string;
  name: string;
  slug: string;
  role: "Owner" | "Recruiter" | "Interviewer";
  jobCounts: JobCounts;
  totalCandidates: number;
  candidateCounts: CandidateStageCounts;
  workload: JobWorkload[];
  recentActivity: OverviewActivity[];
};

/** Returns `null` when the workspace does not exist or the caller is not a member. */
export async function getWorkspaceOverview(workspaceId: string, activityLimit?: number): Promise<WorkspaceOverview | null> {
  try {
    const query = activityLimit ? `?activityLimit=${activityLimit}` : "";
    const overview = await apiRequest<WorkspaceOverview>(`/api/workspaces/${workspaceId}/overview${query}`, {
      method: "GET",
    });
    return overview ?? null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
