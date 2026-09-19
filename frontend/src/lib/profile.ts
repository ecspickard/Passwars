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

export interface PasswordWonItem {
  service: string;
  player_username: string;
}

export interface UserProfile {
  id: number;
  username: string;
  created_at: string;
  chess_username?: string | null;
  chess_avatar?: string | null;
  chess_stats?: Record<string, number> | null;
  offerings: string[];
  passwords_collected: number;
  passwords_won: PasswordWonItem[];
}

/**
 * Fetch a player's public profile data.
 */
export async function getUserProfile(id: number | string): Promise<UserProfile> {
  return api.get<UserProfile>(`/users/profile/${id}`);
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