import { useEffect, useMemo, useState } from "react";
import { PageHeading } from "../components/PageHeading";
import { VaultEntryCard } from "../components/VaultEntryCard";
import { VaultEntryModal } from "../components/VaultEntryModal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useToast } from "../context/ToastContext";
import { ApiError } from "../lib/api";
import { deleteVaultEntry, listVaultEntries, type VaultEntry } from "../lib/vault";

type ModalState = { mode: "add" } | { mode: "edit"; entry: VaultEntry } | null;

export default function Vault() {
  const { showToast } = useToast();

  const [entries, setEntries] = useState<VaultEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [pendingDelete, setPendingDelete] = useState<VaultEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadEntries = async () => {
    setLoadError(null);
    try {
      const data = await listVaultEntries();
      setEntries(data);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Couldn't load your vault.");
    }
  };

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!entries) return [];
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.service_name.toLowerCase().includes(q));
  }, [entries, query]);

  const handleSaved = (saved: VaultEntry) => {
    const wasEdit = modal?.mode === "edit";
    setEntries((prev) => {
      if (!prev) return [saved];
      const exists = prev.some((e) => e.id === saved.id);
      return exists ? prev.map((e) => (e.id === saved.id ? saved : e)) : [saved, ...prev];
    });
    setModal(null);
    showToast(wasEdit ? "Service updated." : "Service added to your vault.", "success");
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteVaultEntry(pendingDelete.id);
      setEntries((prev) => prev?.filter((e) => e.id !== pendingDelete.id) ?? prev);
      showToast(`Removed ${pendingDelete.service_name}.`, "success");
      setPendingDelete(null);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't delete that entry.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div>
      <PageHeading
        title="Your vault"
        description="The services you've staked, backed by POST /api/users/passwords."
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          placeholder="Search services…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input-field max-w-xs"
          aria-label="Search your vault by service name"
        />
        <button type="button" className="btn-gold" onClick={() => setModal({ mode: "add" })}>
          Add service
        </button>
      </div>

      {loadError && (
        <div className="panel mb-4 border-signal-500 p-4 text-sm text-signal-500">
          {loadError}{" "}
          <button type="button" className="underline" onClick={loadEntries}>
            Try again
          </button>
        </div>
      )}

      {entries === null && !loadError ? (
        <div className="panel p-8 text-center text-steel-400">Loading your vault…</div>
      ) : entries && entries.length === 0 ? (
        <div className="panel p-8 text-center text-steel-400">
          You're not storing anything yet — add your first service.
        </div>
      ) : entries && filtered.length === 0 ? (
        <div className="panel p-8 text-center text-steel-400">
          No services match &ldquo;{query}&rdquo;.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entry) => (
            <VaultEntryCard
              key={entry.id}
              entry={entry}
              onEdit={() => setModal({ mode: "edit", entry })}
              onDelete={() => setPendingDelete(entry)}
            />
          ))}
        </div>
      )}

      {modal && (
        <VaultEntryModal
          mode={modal.mode}
          entry={modal.mode === "edit" ? modal.entry : undefined}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Remove this service?"
          message={`This deletes "${pendingDelete.service_name}" from your vault. This can't be undone.`}
          confirmLabel="Delete"
          isConfirming={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
