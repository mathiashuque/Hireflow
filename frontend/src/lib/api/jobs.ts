import { ApiError, apiRequest } from "./client";

export type JobStatus = "Draft" | "Open" | "Closed";

export type JobOpening = {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  status: JobStatus;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  /** Opaque optimistic-concurrency token; echo it back unchanged on the next edit/status change. */
  version: string;
};

export type CreateJobInput = {
  title: string;
  description?: string;
};

export type UpdateJobInput = {
  title: string;
  description?: string;
  version: string;
};

/** Returns `null` when the workspace does not exist or the caller is not a member. */
export async function listJobs(workspaceId: string, status?: JobStatus): Promise<JobOpening[] | null> {
  try {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const jobs = await apiRequest<JobOpening[]>(`/api/workspaces/${workspaceId}/jobs${query}`, { method: "GET" });
    return jobs ?? [];
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/** Returns `null` when the workspace/job does not exist or the caller is not a member. */
export async function getJob(workspaceId: string, jobId: string): Promise<JobOpening | null> {
  try {
    const job = await apiRequest<JobOpening>(`/api/workspaces/${workspaceId}/jobs/${jobId}`, { method: "GET" });
    return job ?? null;
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

export async function createJob(workspaceId: string, input: CreateJobInput): Promise<JobOpening> {
  const job = await apiRequest<JobOpening>(`/api/workspaces/${workspaceId}/jobs`, { method: "POST", body: input });
  return job!;
}

export async function updateJob(workspaceId: string, jobId: string, input: UpdateJobInput): Promise<JobOpening> {
  const job = await apiRequest<JobOpening>(`/api/workspaces/${workspaceId}/jobs/${jobId}`, {
    method: "PATCH",
    body: input,
  });
  return job!;
}

export async function changeJobStatus(
  workspaceId: string,
  jobId: string,
  status: "Open" | "Closed",
  version: string,
): Promise<JobOpening> {
  const job = await apiRequest<JobOpening>(`/api/workspaces/${workspaceId}/jobs/${jobId}/status`, {
    method: "PATCH",
    body: { status, version },
  });
  return job!;
}

/** True when a mutation failed because the job changed since the client last loaded it. */
export function isConcurrencyConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
