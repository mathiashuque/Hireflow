export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-lg border border-border bg-surface shadow-[var(--shadow-card)] ${className ?? ""}`}
      {...props}
    />
  );
}
