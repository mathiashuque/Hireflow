function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "?";
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

type WorkspaceMonogramProps = {
  name: string;
  className?: string;
};

/**
 * A compact, deterministic workspace identifier derived from the workspace name — one or
 * two initials in a styled monogram. Decorative: the name is already rendered as text
 * beside it, so this is hidden from assistive technology rather than announced twice.
 */
export function WorkspaceMonogram({ name, className }: WorkspaceMonogramProps) {
  return (
    <div
      aria-hidden="true"
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-lg font-semibold text-brand-strong ${className ?? ""}`}
    >
      {getInitials(name)}
    </div>
  );
}
