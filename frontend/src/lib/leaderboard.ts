// Leaderboard data + rank lookups, built on GET /api/users/leaderboard.
//
// The backend has no offset/cursor param - `?limit=` is the only knob, and
// it returns every user (outer-joined against PasswordBank) ordered by
// password_count desc, just capped at `limit`. So:
//  - "pagination" on the /leaderboard page means asking for a bigger limit
//    each time ("Show more"), not a real page 2/3/4.
//  - finding one player's rank means asking for (essentially) everyone and
//    finding their position client-side, since there's no /leaderboard/{id}.

import { api } from "./api";
import type { LeaderboardEntry } from "./types";

/** Rows shown on first load of the /leaderboard page. */
export const DEFAULT_LEADERBOARD_LIMIT = 25;
/** How many more rows "Show more" asks for each time. */
export const LEADERBOARD_PAGE_SIZE = 25;
/**
 * Comfortably above any realistic player count for this app. Used when we
 * need the *whole* board (e.g. to find one player's rank) rather than a
 * page of it.
 */
export const LEADERBOARD_MAX_LIMIT = 5000;

export function fetchLeaderboard(limit: number): Promise<LeaderboardEntry[]> {
  return api.get<LeaderboardEntry[]>(`/users/leaderboard?limit=${limit}`);
}

export interface RankInfo {
  /** 1-indexed position. */
  rank: number;
  totalPlayers: number;
  entry: LeaderboardEntry;
}

/**
 * Fetches the full standings and finds this player's position in them.
 * Returns null if the player has no rank yet (shouldn't normally happen,
 * since the backend includes every user via an outer join, but a missing
 * id is treated as "unranked" rather than thrown).
 */
export async function getRankForUser(userId: number): Promise<RankInfo | null> {
  const board = await fetchLeaderboard(LEADERBOARD_MAX_LIMIT);
  const index = board.findIndex((entry) => entry.id === userId);
  if (index === -1) return null;
  return { rank: index + 1, totalPlayers: board.length, entry: board[index] };
}
