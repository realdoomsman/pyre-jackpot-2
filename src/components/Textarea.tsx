import { useId, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cx } from "./cx";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

/** Multi-line field; same border, radius and violet focus as `Input`. */
export function Textarea({ label, hint, error, className, rows = 3, id, ...rest }: TextareaProps) {
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
      <textarea
        aria-describedby={described}
        aria-invalid={error !== undefined || undefined}
        className={cx(
          "w-full resize-y rounded-card border bg-bg px-3 py-2 text-sm leading-relaxed text-ink outline-none transition-colors",
          "placeholder:text-ink-faint focus:border-violet disabled:cursor-not-allowed disabled:opacity-50",
          error !== undefined ? "border-danger" : "border-border hover:border-border-strong",
        )}
        id={fieldId}
        rows={rows}
        {...rest}
      />
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
