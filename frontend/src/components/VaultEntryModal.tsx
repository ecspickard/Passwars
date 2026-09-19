import { useState, type FormEvent } from "react";
import { FormError, FormField } from "./FormField";
import { SecretField } from "./SecretField";
import { generateStrongPassword } from "../lib/generatePassword";
import { ApiError } from "../lib/api";
import { addVaultEntry, updateVaultEntry, type VaultEntry } from "../lib/vault";

const SERVICE_NAME_MAX = 100; // matches UserPassword.service_name String(100)

interface Props {
  mode: "add" | "edit";
  /** Required when mode === "edit". */
  entry?: VaultEntry;
  onClose: () => void;
  onSaved: (entry: VaultEntry) => void;
}

export function VaultEntryModal({ mode, entry, onClose, onSaved }: Props) {
  const isEdit = mode === "edit";

  const [serviceName, setServiceName] = useState(entry?.service_name ?? "");
  const [username, setUsername] = useState(""); // Note: We don't fetch username for edit unless we trigger reveal
  // Holds a real password while this form is open — that's unavoidable
  // while the user is typing it in, but it's local to this component, never
  // logged, and discarded the moment the modal closes (nothing here lifts
  // it into Vault.tsx or any longer-lived state).
  const [secret, setSecret] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = serviceName.trim();
    if (!trimmedName) {
      setFormError("Enter a service name.");
      return;
    }
    if (!isEdit && !secret) {
      setFormError("Enter a password to store.");
      return;
    }

    setIsSubmitting(true);
    try {
      let saved: VaultEntry;
      if (isEdit && entry) {
        const updates: { service_name?: string; secret_value?: string; username?: string } = {};
        if (trimmedName !== entry.service_name) updates.service_name = trimmedName;
        if (secret) updates.secret_value = secret;
        if (username) updates.username = username;
        saved = Object.keys(updates).length > 0 ? await updateVaultEntry(entry.id, updates) : entry;
      } else {
        saved = await addVaultEntry(trimmedName, secret, username);
      }
      onSaved(saved);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't save this entry. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vault-modal-title"
    >
      <div className="bg-ink-900/97 border border-ink-700 rounded-panel shadow-2xl shadow-black/50 w-full max-w-sm p-6">
        <h2 id="vault-modal-title" className="font-display text-lg text-parchment-50">
          {isEdit ? "Edit service" : "Add a service"}
        </h2>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          {formError && <FormError message={formError} />}

          <FormField id="vault-service-name" label="Service name">
            <input
              id="vault-service-name"
              className="input-field"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              maxLength={SERVICE_NAME_MAX}
              autoFocus
              disabled={isSubmitting}
            />
          </FormField>

          <FormField
            id="vault-username"
            label="Username/Email"
            hint={isEdit ? "Leave blank to keep current Username/Email." : "Optional"}
          >
            <input
              id="vault-username"
              type="text"
              className="input-field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isSubmitting}
              placeholder="user@example.com"
            />
          </FormField>

          <FormField
            id="vault-secret"
            label="Password"
            hint={isEdit ? "Leave blank to keep the current password." : undefined}
          >
            <SecretField
              id="vault-secret"
              value={secret}
              onChange={setSecret}
              onGenerate={() => setSecret(generateStrongPassword())}
              disabled={isSubmitting}
              placeholder={isEdit ? "••••••••••••" : undefined}
            />
          </FormField>

          <div className="mt-2 flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn-gold" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Add service"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
