import { useState } from "react";
import { Link } from "react-router-dom";
import { revealBankSecret, type BankEntry, type BankSecretReveal } from "../lib/bank";
import { CopySecretButton } from "./CopySecretButton";

export function BankEntryCard({
  entry,
  ownerName,
}: {
  entry: BankEntry;
  /** Resolved username of the previous owner, if known. */
  ownerName?: string;
}) {
  const [revealData, setRevealData] = useState<BankSecretReveal | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const collectedDate = entry.collected_at
    ? new Date(entry.collected_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  const handleRevealStart = async () => {
    setIsRevealed(true);
    if (!revealData && !isLoading) {
      setIsLoading(true);
      try {
        const data = await revealBankSecret(entry.id);
        setRevealData(data);
      } catch (err) {
        // fail silently for the hold interaction
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleRevealEnd = () => {
    setIsRevealed(false);
  };

  return (
    <div className="panel flex flex-col gap-3 p-4">
      <div>
        <p className="break-words font-display text-base text-parchment-50">{entry.service_name}</p>
        <p className="text-xs text-steel-400">
          Won from{" "}
          {entry.collected_from !== null ? (
            <Link to={`/profile/${entry.collected_from}`} className="text-gold-400 hover:underline">
              {ownerName ?? `Player #${entry.collected_from}`}
            </Link>
          ) : (
            "a player who has since left"
          )}
          {collectedDate && <> on {collectedDate}</>}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 min-h-[48px] rounded bg-ink-950/50 p-2 font-mono text-sm text-steel-400">
          {isRevealed ? (
            isLoading ? (
              <span className="text-steel-500">Decrypting...</span>
            ) : revealData ? (
              <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 w-full justify-center h-full items-center">
                <span className="text-steel-500 select-none text-right">User:</span>
                <span className={revealData.username ? "text-parchment-100" : "text-steel-600 italic break-all"}>
                  {revealData.username || "None"}
                </span>
                <span className="text-steel-500 select-none text-right">Pass:</span>
                <span className="text-parchment-100 break-all">{revealData.password_value}</span>
              </div>
            ) : (
              <span className="text-signal-500">Error</span>
            )
          ) : (
            <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 w-full justify-center h-full items-center">
              <span className="text-steel-500 select-none text-right">User:</span>
              <span className="text-steel-400 tracking-widest select-none" aria-hidden>••••••</span>
              <span className="text-steel-500 select-none text-right">Pass:</span>
              <span className="text-steel-400 tracking-widest select-none" aria-hidden>••••••</span>
            </div>
          )}
        </div>
        
        <button
          className="rounded p-2 text-steel-500 hover:bg-ink-800 hover:text-gold-400 active:bg-ink-700 active:text-gold-300 touch-none"
          onMouseDown={handleRevealStart}
          onMouseUp={handleRevealEnd}
          onMouseLeave={handleRevealEnd}
          onTouchStart={handleRevealStart}
          onTouchEnd={handleRevealEnd}
          title="Hold to reveal"
          aria-label="Hold to reveal password"
        >
          <EyeIcon className="h-5 w-5" />
        </button>
      </div>

      <div>
        <CopySecretButton
          serviceName={entry.service_name}
          fetchSecret={async () => (await revealBankSecret(entry.id)).password_value}
        />
      </div>
    </div>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
