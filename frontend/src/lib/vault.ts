// API calls for the user's own vault (UserPassword entries). Deliberately
// separate from lib/api.ts's generic wrapper: nothing here ever holds a
// decrypted secret longer than the single call that needed it.

import { api } from "./api";

export interface VaultEntry {
  id: number;
  service_name: string;
  created_at: string;
}

export interface VaultSecretReveal {
  id: number;
  service_name: string;
  secret_value: string;
}

export interface VaultEntryUpdate {
  service_name?: string;
  secret_value?: string;
}

export const listVaultEntries = () => api.get<VaultEntry[]>("/users/passwords");

export const addVaultEntry = (service_name: string, secret_value: string) =>
  api.post<VaultEntry>("/users/passwords", { service_name, secret_value });

export const updateVaultEntry = (id: number, updates: VaultEntryUpdate) =>
  api.patch<VaultEntry>(`/users/passwords/${id}`, updates);

export const deleteVaultEntry = (id: number) => api.delete<void>(`/users/passwords/${id}`);

/**
 * Fetches the decrypted secret fresh, every time. Callers must use the
 * result immediately (copy it, display it briefly) and must not stash it in
 * component state, a ref that outlives the action, or anywhere else that
 * could linger — the whole point of "reveal on demand" is that the
 * plaintext only ever exists for the duration of one user action.
 */
export const revealVaultSecret = (id: number) =>
  api.get<VaultSecretReveal>(`/users/passwords/${id}/reveal`);
