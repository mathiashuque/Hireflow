type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

/** One clear title, optional supporting context, and a predictable slot for primary actions. */
export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">{eyebrow}</p>
        ) : null}
        <h1 className={`text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl ${eyebrow ? "mt-1" : ""}`}>
          {title}
        </h1>
        {description ? <p className="mt-1.5 text-sm text-text-secondary">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
