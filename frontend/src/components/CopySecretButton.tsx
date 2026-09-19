import { useCopySecret } from "../hooks/useCopySecret";

/**
 * "Copy password" button with the reveal-on-demand + auto-clearing clipboard
 * behavior. `fetchSecret` must resolve to the plaintext secret; it's called
 * fresh on every click.
 */
export function CopySecretButton({
  serviceName,
  fetchSecret,
}: {
  serviceName: string;
  fetchSecret: () => Promise<string>;
}) {
  const { copy, isCopying, secondsLeft } = useCopySecret(serviceName, fetchSecret);

  return (
    <button type="button" onClick={copy} className="btn-ghost text-xs" disabled={isCopying}>
      {isCopying
        ? "Copying…"
        : secondsLeft !== null
          ? `Copied · clears in ${secondsLeft}s`
          : "Copy password"}
    </button>
  );
}
