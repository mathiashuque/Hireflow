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

/** Roles an invitation can grant. Owner is never assigned through an invitation. */
export type InvitableRole = "Recruiter" | "Interviewer";

export type CreateInvitationInput = {
  email: string;
  role: InvitableRole;
};

/** The invitation as returned exactly once, immediately after creation. */
export type CreatedInvitation = {
  id: string;
  email: string;
  role: InvitableRole;
  expiresAt: string;
  token: string;
};

export type PendingInvitation = {
  id: string;
  email: string;
  role: InvitableRole;
  createdAt: string;
  expiresAt: string;
  invitedByUserId: string;
  invitedByDisplayName: string;
};

/** Returns `null` when the workspace does not exist or the caller is not an Owner. */
export async function createInvitation(
  workspaceId: string,
  input: CreateInvitationInput,
): Promise<CreatedInvitation> {
  const invitation = await apiRequest<CreatedInvitation>(`/api/workspaces/${workspaceId}/invitations`, {
    method: "POST",
    body: input,
  });
  return invitation!;
}

/** Returns `null` when the workspace does not exist or the caller is not an Owner. */
export async function listPendingInvitations(workspaceId: string): Promise<PendingInvitation[] | null> {
  try {
    const invitations = await apiRequest<PendingInvitation[]>(`/api/workspaces/${workspaceId}/invitations`, {
      method: "GET",
    });
    return invitations ?? [];
  } catch (error) {
    if (isNotFoundOrForbidden(error)) {
      return null;
    }
    throw error;
  }
}

export async function revokeInvitation(workspaceId: string, invitationId: string): Promise<void> {
  await apiRequest<void>(`/api/workspaces/${workspaceId}/invitations/${invitationId}`, { method: "DELETE" });
}

/**
 * Accepts an invitation for the current authenticated account. Every failure (invalid,
 * expired, revoked, already used, or wrong account) surfaces as the same generic
 * `ApiError`; the caller must not try to distinguish them.
 */
export async function acceptInvitation(token: string): Promise<{ workspaceId: string }> {
  const result = await apiRequest<{ workspaceId: string }>(`/api/invitations/${encodeURIComponent(token)}/accept`, {
    method: "POST",
  });
  return result!;
}

export async function changeMemberRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<void> {
  await apiRequest<void>(`/api/workspaces/${workspaceId}/members/${userId}/role`, {
    method: "PATCH",
    body: { role },
  });
}

export async function removeMember(workspaceId: string, userId: string): Promise<void> {
  await apiRequest<void>(`/api/workspaces/${workspaceId}/members/${userId}`, { method: "DELETE" });
}

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

function isNotFoundOrForbidden(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 403);
}
