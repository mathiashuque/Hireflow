type FormFieldProps = {
  id: string;
  label: string;
  type: "email" | "password" | "text";
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
};

export function FormField({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
  error,
  disabled,
  required = true,
}: FormFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text-primary">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand-soft disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted"
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
