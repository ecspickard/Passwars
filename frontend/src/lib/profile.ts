// Profile management API wrappers for settings page.

import { api } from "./api";
import type { User } from "./types";

export interface ProfileUpdateRequest {
  username?: string;
  email?: string;
}

export interface AccountDeleteRequest {
  password: string;
}

/**
 * Update the current user's profile (username and/or email).
 * Both fields are optional — omit to keep unchanged.
 */
export async function updateProfile(data: ProfileUpdateRequest): Promise<User> {
  return api.put<User>("/users/profile", data);
}

/**
 * Permanently delete the current user's account.
 * Requires password confirmation for security.
 * Returns void (204 No Content) on success.
 * Throws ApiError on wrong password or other failure.
 */
export async function deleteAccount(password: string): Promise<void> {
  await api.delete<void>("/users/account", { body: { password } });
}