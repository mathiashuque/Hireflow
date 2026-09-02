import type { CandidateNote } from "@/lib/api/candidates";

export function CandidateNotesTimeline({ notes }: { notes: CandidateNote[] }) {
  if (notes.length === 0) {
    return <p className="text-sm text-slate-500">No internal notes yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-3">
      {notes.map((note) => (
        <li key={note.id} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="whitespace-pre-wrap text-sm text-slate-800">{note.content}</p>
          <p className="mt-2 text-xs text-slate-500">
            {note.authorDisplayName ?? "A former member"} · {new Date(note.createdAt).toLocaleString()}
          </p>
        </li>
      ))}
    </ol>
  );
}
