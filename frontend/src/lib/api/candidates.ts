import { ApiError, apiRequest } from "./client";

export type CandidateStage = "Applied" | "Screening" | "Interview" | "Offer" | "Rejected";

export const CANDIDATE_STAGES: CandidateStage[] = ["Applied", "Screening", "Interview", "Offer", "Rejected"];

export type Candidate = {
  id: string;
  workspaceId: string;
  jobOpeningId: string;
  name: string;
  email: string;
  stage: CandidateStage;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  /** Opaque optimistic-concurrency token; echo it back unchanged on the next edit. */
  version: string;
};

export type CreateCandidateInput = {
  name: string;
  email: string;
};

export type UpdateCandidateInput = {
  name: string;
  email: string;
  version: string;
};

/** Returns `null` when the workspace/job does not exist or the caller is not a member. */
export async function listCandidates(
  workspaceId: string,
  jobId: string,
  stage?: CandidateStage,
): Promise<Candidate[] | null> {
  try {
    const query = stage ? `?stage=${encodeURIComponent(stage)}` : "";
    const candidates = await apiRequest<Candidate[]>(
      `/api/workspaces/${workspaceId}/jobs/${jobId}/candidates${query}`,
      { method: "GET" },
    );
    return candidates ?? [];
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/** Returns `null` when the workspace/candidate does not exist or the caller is not a member. */
export async function getCandidate(workspaceId: string, candidateId: string): Promise<Candidate | null> {
  try {
    const candidate = await apiRequest<Candidate>(`/api/workspaces/${workspaceId}/candidates/${candidateId}`, {
      method: "GET",
    });
    return candidate ?? null;
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

export async function createCandidate(
  workspaceId: string,
  jobId: string,
  input: CreateCandidateInput,
): Promise<Candidate> {
  const candidate = await apiRequest<Candidate>(`/api/workspaces/${workspaceId}/jobs/${jobId}/candidates`, {
    method: "POST",
    body: input,
  });
  return candidate!;
}

export async function updateCandidate(
  workspaceId: string,
  candidateId: string,
  input: UpdateCandidateInput,
): Promise<Candidate> {
  const candidate = await apiRequest<Candidate>(`/api/workspaces/${workspaceId}/candidates/${candidateId}`, {
    method: "PATCH",
    body: input,
  });
  return candidate!;
}

/** True when a create failed because the target job is Draft or Closed. */
export function isJobNotOpenConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409 && error.message.toLowerCase().includes("open job");
}

/** True when a mutation failed because another candidate in the job already has this email. */
export function isDuplicateEmailConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409 && error.message.toLowerCase().includes("already exists");
}

/** True when an edit failed because the candidate changed since the client last loaded it. */
export function isConcurrencyConflict(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    !isJobNotOpenConflict(error) &&
    !isDuplicateEmailConflict(error)
  );
}

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
