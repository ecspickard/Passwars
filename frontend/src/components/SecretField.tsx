import { useState } from "react";

/**
 * Masked input for a vault secret, with a show/hide toggle and an optional
 * "generate strong password" action. Distinct from PasswordInput (used on
 * the auth screens for the user's own login password) since this one is
 * never meant to autofill from a browser-saved credential.
 */
export function SecretField({
  id,
  value,
  onChange,
  onGenerate,
  invalid,
  describedBy,
  disabled,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onGenerate?: () => void;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          className={`input-field pr-16 font-mono ${invalid ? "border-signal-500" : ""}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          disabled={disabled}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute inset-y-0 right-0 px-3 text-xs text-steel-400 transition-colors hover:text-gold-400"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {onGenerate && (
        <button
          type="button"
          onClick={onGenerate}
          className="self-start text-xs text-gold-400 hover:underline"
          disabled={disabled}
        >
          Generate strong password
        </button>
      )}
    </div>
  );
}
