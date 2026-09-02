export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-surface-muted ${className ?? ""}`} />;
}

/** A readable status line paired with a decorative skeleton block, so loading state remains announced. */
export function SkeletonBlock({ label, className }: { label: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-sm text-text-muted">{label}</p>
      <div className="mt-3 flex flex-col gap-2" aria-hidden>
        <Skeleton className="h-4 w-full max-w-sm" />
        <Skeleton className="h-4 w-full max-w-xs" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
    </div>
  );
}
