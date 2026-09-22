import { useId, type ReactNode, type SelectHTMLAttributes } from "react";
import { cx } from "./cx";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}

/** Native select on the page colour: one control, no custom dropdown to get wrong. */
export function Select({ label, hint, error, className, id, children, ...rest }: SelectProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const described = cx(hint !== undefined && hintId, error !== undefined && errorId) || undefined;

  return (
    <div className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      {label !== undefined ? (
        <label className="text-sm text-ink-muted" htmlFor={fieldId}>
          {label}
        </label>
      ) : null}
      <select
        aria-describedby={described}
        aria-invalid={error !== undefined || undefined}
        className={cx(
          "h-10 w-full appearance-none rounded-card border bg-bg px-3 text-sm text-ink outline-none transition-colors",
          "focus:border-violet disabled:cursor-not-allowed disabled:opacity-50",
          error !== undefined ? "border-danger" : "border-border hover:border-border-strong",
        )}
        id={fieldId}
        {...rest}
      >
        {children}
      </select>
      {error !== undefined ? (
        <p className="text-sm text-danger" id={errorId} role="alert">
          {error}
        </p>
      ) : hint !== undefined ? (
        <p className="text-sm text-ink-faint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
