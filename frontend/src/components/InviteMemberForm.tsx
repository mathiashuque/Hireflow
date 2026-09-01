"use client";

import { useState } from "react";
import { FormField } from "@/components/FormField";
import { ApiError, ApiUnavailableError } from "@/lib/api/client";
import { createInvitation, type CreatedInvitation, type InvitableRole } from "@/lib/api/workspaces";

type InviteMemberFormProps = {
  workspaceId: string;
  onCreated: (invitation: CreatedInvitation) => void;
};

export function InviteMemberForm({ workspaceId, onCreated }: InviteMemberFormProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitableRole>("Recruiter");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const invitation = await createInvitation(workspaceId, { email, role });
      setEmail("");
      onCreated(invitation);
    } catch (error) {
      if (error instanceof ApiUnavailableError) {
        setFormError(error.message);
      } else if (error instanceof ApiError) {
        setFieldErrors(error.fieldErrors);
        setFormError(Object.keys(error.fieldErrors).length === 0 ? error.message : null);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex w-full max-w-sm flex-col gap-4">
      {formError ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
        </p>
      ) : null}

      <FormField
        id="inviteEmail"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="off"
        disabled={isSubmitting}
        error={fieldErrors.Email?.[0]}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="inviteRole" className="text-sm font-medium text-slate-800">
          Role
        </label>
        <select
          id="inviteRole"
          value={role}
          onChange={(event) => setRole(event.target.value as InvitableRole)}
          disabled={isSubmitting}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        >
          <option value="Recruiter">Recruiter</option>
          <option value="Interviewer">Interviewer</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {isSubmitting ? "Sending invitation…" : "Invite"}
      </button>
    </form>
  );
}
