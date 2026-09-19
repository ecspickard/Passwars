import type { ReactNode } from "react";

/** Label + control + inline error/hint. Give the control `id={id}`. */
export function FormField({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string | null;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-300">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-steel-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Form-level error banner (wrong credentials, duplicate account, network). */
export function FormError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-panel border border-signal-500 bg-signal-500/10 px-3 py-2 text-sm text-parchment-50"
    >
      {message}
    </div>
  );
}
