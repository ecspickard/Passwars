import { useState, useEffect } from "react";
import { revealVaultSecret, type VaultEntry, type VaultSecretReveal } from "../lib/vault";
import { CopySecretButton } from "./CopySecretButton";

export function VaultEntryCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: VaultEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [revealData, setRevealData] = useState<VaultSecretReveal | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setRevealData(null);
  }, [entry]);

  const addedDate = entry.created_at
    ? new Date(entry.created_at).toLocaleDateString(undefined, {
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
        const data = await revealVaultSecret(entry.id);
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
        {addedDate && <p className="text-xs text-steel-400">Added {addedDate}</p>}
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

      <div className="flex items-center justify-between gap-2 mt-1">
        <CopySecretButton
          serviceName={entry.service_name}
          fetchSecret={async () => (await revealVaultSecret(entry.id)).password_value}
        />
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-panel p-2 text-steel-400 transition-colors hover:bg-ink-800 hover:text-gold-400"
            aria-label={`Edit ${entry.service_name}`}
            title="Edit"
          >
            <EditIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-panel p-2 text-steel-400 transition-colors hover:bg-ink-800 hover:text-signal-500"
            aria-label={`Delete ${entry.service_name}`}
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
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
