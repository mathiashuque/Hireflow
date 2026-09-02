type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-border-strong bg-surface-muted/60 px-6 py-8 text-center">
      <p className="text-sm font-medium text-text-primary">{title}</p>
      {description ? <p className="mt-1.5 text-sm text-text-secondary">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
