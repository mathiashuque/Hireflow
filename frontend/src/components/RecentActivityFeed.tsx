import Link from "next/link";
import type { OverviewActivity } from "@/lib/api/overview";
import { formatRelativeTime } from "@/lib/relativeTime";

export function RecentActivityFeed({ workspaceId, activity }: { workspaceId: string; activity: OverviewActivity[] }) {
  if (activity.length === 0) {
    return <p className="text-sm text-slate-500">No recent activity yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-3">
      {activity.map((entry) => (
        <li key={entry.id} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-sm text-slate-800">{describe(workspaceId, entry)}</p>
          <p className="mt-1 text-xs text-slate-500">
            {entry.actorDisplayName ?? "A former member"} · {formatRelativeTime(entry.occurredAt)}
          </p>
        </li>
      ))}
    </ol>
  );
}

function describe(workspaceId: string, entry: OverviewActivity) {
  const jobLink = entry.jobId ? (
    <Link
      href={`/workspaces/${workspaceId}/jobs/${entry.jobId}/candidates`}
      className="font-medium text-indigo-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
    >
      {entry.jobTitle}
    </Link>
  ) : null;

  const candidateLink = entry.candidateId ? (
    <Link
      href={`/workspaces/${workspaceId}/candidates/${entry.candidateId}`}
      className="font-medium text-indigo-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
    >
      {entry.candidateName}
    </Link>
  ) : null;

  switch (entry.kind) {
    case "JobCreated":
      return <>Created job {jobLink}</>;
    case "CandidateAdded":
      return (
        <>
          Added {candidateLink} to {jobLink}
        </>
      );
    case "CandidateStageChanged":
      return (
        <>
          Moved {candidateLink} from <span className="font-medium">{entry.previousStage}</span> to{" "}
          <span className="font-medium">{entry.newStage}</span>
        </>
      );
    case "CandidateNoteAdded":
      return <>Added a note on {candidateLink}</>;
    default:
      return null;
  }
}
