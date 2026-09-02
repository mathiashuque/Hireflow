"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ApiError } from "@/lib/api/client";
import { changeMemberRole, removeMember, type WorkspaceMember, type WorkspaceRole } from "@/lib/api/workspaces";
import { Button } from "@/components/ui/Button";
import { AnimatedStatus, StatusBanner } from "@/components/ui/StatusBanner";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { useI18n } from "@/i18n/LocaleProvider";
import { roleLabel } from "@/i18n/enumLabels";
import type { Dictionary } from "@/i18n/dictionaries";

type MembersListProps = {
  workspaceId: string;
  members: WorkspaceMember[];
  currentUserId: string;
  canManage: boolean;
  onChanged: () => void;
};

const ROLES: WorkspaceRole[] = ["Owner", "Recruiter", "Interviewer"];

export function MembersList({ workspaceId, members, currentUserId, canManage, onChanged }: MembersListProps) {
  const { dict } = useI18n();
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
      setError(describeError(dict, caught, dict.members.changeRoleFailed));
    } finally {
      setPendingUserId(null);
    }
  }

  async function handleRemove(userId: string, displayName: string) {
    if (!window.confirm(dict.members.confirmRemove(displayName))) {
      return;
    }

    setError(null);
    setPendingUserId(userId);
    try {
      await removeMember(workspaceId, userId);
      onChanged();
    } catch (caught) {
      setError(describeError(dict, caught, dict.members.removeFailed));
    } finally {
      setPendingUserId(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <AnimatedStatus id={error}>
        <StatusBanner tone="danger" role="alert">
          {error}
        </StatusBanner>
      </AnimatedStatus>

      <motion.ul
        layout
        initial="hidden"
        animate="show"
        variants={staggerContainer}
        className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface"
      >
        {members.map((member) => {
          const isLastOwner = member.role === "Owner" && ownerCount <= 1;
          const isPending = pendingUserId === member.userId;

          return (
            <motion.li
              key={member.userId}
              layout
              variants={staggerItem}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <span className="text-sm text-text-primary">{member.displayName}</span>
                {member.userId === currentUserId ? <span className="ml-2 text-xs text-text-muted">({dict.common.you})</span> : null}
              </div>

              {canManage ? (
                <div className="flex items-center gap-2">
                  <label className="sr-only" htmlFor={`role-${member.userId}`}>
                    {dict.members.roleLabelFor(member.displayName)}
                  </label>
                  <select
                    id={`role-${member.userId}`}
                    value={member.role}
                    disabled={isPending || isLastOwner}
                    onChange={(event) => void handleRoleChange(member.userId, event.target.value as WorkspaceRole)}
                    title={isLastOwner ? dict.members.lastOwnerTitle : undefined}
                    className="rounded-lg border border-border-strong bg-surface px-2 py-1 text-xs text-text-primary outline-none transition focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand-soft disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted"
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {roleLabel(dict, role)}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={isPending || isLastOwner}
                    title={isLastOwner ? dict.members.lastOwnerTitle : undefined}
                    onClick={() => void handleRemove(member.userId, member.displayName)}
                  >
                    {dict.members.remove}
                  </Button>
                </div>
              ) : (
                <span className="text-xs uppercase tracking-wide text-text-muted">{roleLabel(dict, member.role)}</span>
              )}
            </motion.li>
          );
        })}
      </motion.ul>
    </div>
  );
}

function describeError(dict: Dictionary, error: unknown, action: string): string {
  if (error instanceof ApiError && error.hasCode("last_owner")) {
    return dict.errors.last_owner;
  }
  if (error instanceof ApiError) {
    return dict.errors.generic;
  }
  return dict.members.genericFailed(action);
}
