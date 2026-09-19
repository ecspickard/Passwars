import { useEffect, useRef, useState } from "react";
import { useToast } from "../context/ToastContext";
import { ApiError } from "../lib/api";
import { revealVaultSecret, type VaultEntry } from "../lib/vault";

const CLIPBOARD_CLEAR_SECONDS = 20;

export function VaultEntryCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: VaultEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { showToast } = useToast();
  const [isCopying, setIsCopying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Identifies *this* copy's own pending clear, so an older timer can't wipe
  // out a clipboard write made by a newer copy (this card or another).
  const copyTokenRef = useRef(0);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    setIsCopying(true);
    const myToken = ++copyTokenRef.current;

    try {
      // Fetched fresh on every click and used immediately. This binding is
      // local to this function call — it is never assigned to component
      // state, a ref, or anything else that outlives this click.
      const { secret_value } = await revealVaultSecret(entry.id);
      await navigator.clipboard.writeText(secret_value);

      showToast(
        `Copied the password for ${entry.service_name} — clearing in ${CLIPBOARD_CLEAR_SECONDS}s.`,
        "info",
      );

      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);

      setSecondsLeft(CLIPBOARD_CLEAR_SECONDS);
      tickTimerRef.current = setInterval(() => {
        setSecondsLeft((s) => (s !== null && s > 1 ? s - 1 : 0));
      }, 1000);

      clearTimerRef.current = setTimeout(async () => {
        if (tickTimerRef.current) clearInterval(tickTimerRef.current);
        // A newer copy has already taken over the clipboard - don't stomp it.
        if (copyTokenRef.current !== myToken) return;
        try {
          await navigator.clipboard.writeText("");
          showToast("Clipboard cleared.", "success");
        } catch {
          // Clipboard access can be revoked (tab lost focus, permission
          // changed) between the copy and now - nothing left to clean up.
        }
        setSecondsLeft(null);
      }, CLIPBOARD_CLEAR_SECONDS * 1000);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Couldn't copy that password. Try again.",
        "error",
      );
    } finally {
      setIsCopying(false);
    }
  };

  const addedDate = entry.created_at
    ? new Date(entry.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="panel flex flex-col gap-3 p-4">
      <div>
        <p className="break-words font-display text-base text-parchment-50">{entry.service_name}</p>
        {addedDate && <p className="text-xs text-steel-400">Added {addedDate}</p>}
      </div>

      <p className="select-none font-mono text-lg tracking-widest text-steel-400" aria-hidden>
        ••••••••••••
      </p>

      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={handleCopy} className="btn-ghost text-xs" disabled={isCopying}>
          {isCopying
            ? "Copying…"
            : secondsLeft !== null
              ? `Copied · clears in ${secondsLeft}s`
              : "Copy password"}
        </button>
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
