import { revealVaultSecret, type VaultEntry } from "../lib/vault";
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
        <CopySecretButton
          serviceName={entry.service_name}
          fetchSecret={async () => (await revealVaultSecret(entry.id)).secret_value}
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
