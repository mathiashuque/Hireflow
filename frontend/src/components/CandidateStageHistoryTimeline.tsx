import type { CandidateStageHistoryEntry } from "@/lib/api/candidates";

export function CandidateStageHistoryTimeline({ history }: { history: CandidateStageHistoryEntry[] }) {
  if (history.length === 0) {
    return <p className="text-sm text-slate-500">No stage changes yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-3">
      {history.map((entry) => (
        <li key={entry.id} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-sm text-slate-800">
            <span className="font-medium">{entry.previousStage}</span>
            {" → "}
            <span className="font-medium">{entry.newStage}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {entry.changedByDisplayName ?? "A former member"} · {new Date(entry.changedAt).toLocaleString()}
          </p>
        </li>
      ))}
    </ol>
  );
}
