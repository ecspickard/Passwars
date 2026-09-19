import { scorePassword } from "../lib/validation";

// Static class strings so Tailwind's scanner sees every one of them.
const SEGMENT_COLOR: Record<number, string> = {
  1: "bg-signal-500",
  2: "bg-gold-600",
  3: "bg-gold-400",
  4: "bg-felt-500",
};

/** Cosmetic strength indicator - the backend does the real hashing. */
export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const { score, label } = scorePassword(password);

  return (
    <div className="mt-1 flex items-center gap-3" aria-live="polite">
      <div className="flex flex-1 gap-1" aria-hidden>
        {[1, 2, 3, 4].map((segment) => (
          <span
            key={segment}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              segment <= score ? SEGMENT_COLOR[score] : "bg-ink-700"
            }`}
          />
        ))}
      </div>
      <span className="w-20 text-right text-xs text-steel-400">
        <span className="sr-only">Password strength: </span>
        {label}
      </span>
    </div>
  );
}
