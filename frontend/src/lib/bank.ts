// API calls for the password bank (services won from other players).
// Same rule as lib/vault.ts: a decrypted secret must never outlive the single
// user action that needed it.

import { api } from "./api";
import type { ProfileResponse } from "./types";

// Matches PasswordBankResponse in schemas.py.
export interface BankEntry {
  id: number;
  service_name: string;
  collected_from: number | null;
  collected_at: string;
}

export interface BankSecretReveal {
  id: number;
  service_name: string;
  secret_value: string;
}

export const listBankEntries = () => api.get<BankEntry[]>("/users/password-bank");

/** Fetched fresh on every call - use immediately, never store. */
export const revealBankSecret = (id: number) =>
  api.get<BankSecretReveal>(`/users/password-bank/${id}/reveal`);

// The bank endpoint only returns the previous owner's numeric id, so
// usernames are resolved through the public profile endpoint. Cached for the
// session since usernames are public and cheap to keep.
const usernameCache = new Map<number, string>();

export async function lookupUsernames(ids: number[]): Promise<Record<number, string>> {
  const unique = [...new Set(ids)];
  const missing = unique.filter((id) => !usernameCache.has(id));

  await Promise.allSettled(
    missing.map(async (id) => {
      const profile = await api.get<ProfileResponse>(`/users/profile/${id}`);
      usernameCache.set(id, profile.username);
    }),
  );

  const result: Record<number, string> = {};
  for (const id of unique) {
    const name = usernameCache.get(id);
    if (name) result[id] = name;
  }
  return result;
}
