const COLUMNS: { label: string; tone: string; count: number }[] = [
  { label: "Applied", tone: "bg-slate-100 text-slate-700", count: 12 },
  { label: "Screening", tone: "bg-sky-50 text-sky-700", count: 6 },
  { label: "Interview", tone: "bg-indigo-50 text-indigo-700", count: 4 },
  { label: "Offer", tone: "bg-emerald-50 text-emerald-700", count: 2 },
];

/** A tasteful, native product composition standing in for the hiring pipeline — no stock imagery. */
export function PipelinePreview() {
  return (
    <div className="relative rounded-xl border border-border bg-surface p-6 shadow-[var(--shadow-card)]">
      <div aria-hidden className="absolute inset-0 rounded-xl bg-grid-fade opacity-40" />
      <div className="relative flex items-center justify-between">
        <p className="text-sm font-semibold text-text-primary">Senior Product Designer</p>
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Open</span>
      </div>

      <div className="relative mt-6 grid grid-cols-4 gap-3">
        {COLUMNS.map((column) => (
          <div key={column.label} className="flex flex-col gap-2">
            <div className={`rounded-md px-2 py-1 text-center text-[11px] font-medium ${column.tone}`}>
              {column.label}
            </div>
            <div className="flex flex-col gap-1.5">
              {Array.from({ length: column.count > 3 ? 3 : column.count }).map((_, index) => (
                <div key={index} className="h-6 rounded-md border border-border bg-surface-muted" />
              ))}
            </div>
            <p className="text-center text-xs text-text-muted">{column.count}</p>
          </div>
        ))}
      </div>

      <svg
        aria-hidden
        viewBox="0 0 320 40"
        className="relative mt-6 w-full text-brand"
        preserveAspectRatio="none"
      >
        <path
          d="M0 30 C 60 10, 100 30, 160 18 S 260 4, 320 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.35"
        />
      </svg>
    </div>
  );
}
