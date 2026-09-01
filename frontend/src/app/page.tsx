const features = [
  "Isolated team workspaces",
  "Jobs and candidate pipelines",
  "Role-aware collaboration",
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 sm:px-10">
      <nav className="flex items-center justify-between">
        <span className="text-lg font-semibold tracking-tight text-slate-950">
          Hireflow
        </span>
        <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600">
          In development
        </span>
      </nav>

      <section className="flex flex-1 flex-col justify-center py-24">
        <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
          Hiring, without the clutter
        </p>
        <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-slate-950 sm:text-7xl">
          Keep every candidate moving forward.
        </h1>
        <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600">
          Hireflow gives teams one secure workspace to organize openings,
          candidates, interviews, and the decisions behind every hire.
        </p>

        <ul className="mt-12 grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
          {features.map((feature) => (
            <li
              key={feature}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              {feature}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
