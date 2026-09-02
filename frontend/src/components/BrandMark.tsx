type BrandMarkProps = {
  withWordmark?: boolean;
  className?: string;
};

/** Small inline SVG mark — a stylized pipeline funnel — plus the Hireflow wordmark. */
export function BrandMark({ withWordmark = true, className }: BrandMarkProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <path
          d="M3 4.5h18l-6.75 8.1v6.15l-4.5 2.25v-8.4L3 4.5Z"
          fill="var(--color-brand)"
        />
      </svg>
      {withWordmark ? (
        <span className="text-lg font-semibold tracking-tight text-text-primary">Hireflow</span>
      ) : null}
    </span>
  );
}
