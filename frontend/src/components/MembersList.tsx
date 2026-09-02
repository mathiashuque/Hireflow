"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api/client";
import { changeMemberRole, removeMember, type WorkspaceMember, type WorkspaceRole } from "@/lib/api/workspaces";

type MembersListProps = {
  workspaceId: string;
  members: WorkspaceMember[];
  currentUserId: string;
  canManage: boolean;
  onChanged: () => void;
};

const ROLES: WorkspaceRole[] = ["Owner", "Recruiter", "Interviewer"];

export function MembersList({ workspaceId, members, currentUserId, canManage, onChanged }: MembersListProps) {
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ownerCount = members.filter((member) => member.role === "Owner").length;

  async function handleRoleChange(userId: string, role: WorkspaceRole) {
    setError(null);
    setPendingUserId(userId);
    try {
      await changeMemberRole(workspaceId, userId, role);
      onChanged();
    } catch (caught) {
      setError(describeError(caught, "change this member's role"));
    } finally {
      setPendingUserId(null);
    }
  }

  async function handleRemove(userId: string, displayName: string) {
    if (!window.confirm(`Remove ${displayName} from this workspace?`)) {
      return;
    }

    setError(null);
    setPendingUserId(userId);
    try {
      await removeMember(workspaceId, userId);
      onChanged();
    } catch (caught) {
      setError(describeError(caught, "remove this member"));
    } finally {
      setPendingUserId(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
        {members.map((member) => {
          const isLastOwner = member.role === "Owner" && ownerCount <= 1;
          const isPending = pendingUserId === member.userId;

          return (
            <li key={member.userId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <span className="text-sm text-slate-900">{member.displayName}</span>
                {member.userId === currentUserId ? <span className="ml-2 text-xs text-slate-400">(you)</span> : null}
              </div>

              {canManage ? (
                <div className="flex items-center gap-2">
                  <label className="sr-only" htmlFor={`role-${member.userId}`}>
                    Role for {member.displayName}
                  </label>
                  <select
                    id={`role-${member.userId}`}
                    value={member.role}
                    disabled={isPending || isLastOwner}
                    onChange={(event) => void handleRoleChange(member.userId, event.target.value as WorkspaceRole)}
                    title={isLastOwner ? "A workspace must always have at least one Owner." : undefined}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 outline-none transition focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleRemove(member.userId, member.displayName)}
                    disabled={isPending || isLastOwner}
                    title={isLastOwner ? "A workspace must always have at least one Owner." : undefined}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <span className="text-xs uppercase tracking-wide text-slate-500">{member.role}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function describeError(error: unknown, action: string): string {
  if (error instanceof ApiError && error.hasCode("last_owner")) {
    return "A workspace must always have at least one Owner.";
  }
  if (error instanceof ApiError) {
    return error.message;
  }
  return `Could not ${action}. Please try again.`;
}
