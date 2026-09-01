import { ApiError, apiRequest } from "./client";

export type WorkspaceRole = "Owner" | "Recruiter" | "Interviewer";

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  role: WorkspaceRole;
};

export type WorkspaceDetail = WorkspaceSummary;

export type WorkspaceMember = {
  userId: string;
  displayName: string;
  role: WorkspaceRole;
  joinedAt: string;
};

export type CreateWorkspaceInput = {
  name: string;
  slug?: string;
};

export async function listWorkspaces(): Promise<WorkspaceSummary[]> {
  const workspaces = await apiRequest<WorkspaceSummary[]>("/api/workspaces", { method: "GET" });
  return workspaces ?? [];
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceDetail> {
  const workspace = await apiRequest<WorkspaceDetail>("/api/workspaces", { method: "POST", body: input });
  return workspace!;
}

/** Returns `null` when the workspace does not exist or the caller is not a member. */
export async function getWorkspace(workspaceId: string): Promise<WorkspaceDetail | null> {
  try {
    const workspace = await apiRequest<WorkspaceDetail>(`/api/workspaces/${workspaceId}`, { method: "GET" });
    return workspace ?? null;
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/** Returns `null` when the workspace does not exist or the caller is not a member. */
export async function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[] | null> {
  try {
    const members = await apiRequest<WorkspaceMember[]>(`/api/workspaces/${workspaceId}/members`, {
      method: "GET",
    });
    return members ?? [];
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
