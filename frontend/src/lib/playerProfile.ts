// Everything the public profile page needs, fetched in parallel.
//
// Only the profile itself is required. The Chess.com handle and leaderboard
// standing are extras: if either request fails the page still renders, with
// that piece shown as unavailable.

import { api } from "./api";
import { lookupParticipants } from "./challenges";
import { LEADERBOARD_FETCH_LIMIT, fetchLeaderboard, rankEntries } from "./leaderboard";
import type { ProfileResponse } from "./types";

export type Standing =
  | { status: "ranked"; rank: number; of: number; /** `of` is a floor, not the true total. */ truncated: boolean }
  | { status: "outside"; limit: number }
  | { status: "unavailable" };

export interface PlayerProfile {
  profile: ProfileResponse;
  /** Verified Chess.com handle only (the players list hides unverified ones). */
  chessUsername: string | null;
  standing: Standing;
}

export async function loadPlayerProfile(id: number): Promise<PlayerProfile> {
  const [profileRes, participantsRes, boardRes] = await Promise.allSettled([
    api.get<ProfileResponse>(`/users/profile/${id}`),
    lookupParticipants([id]),
    fetchLeaderboard(),
  ]);

  // A 404 here means "no such player", so let the caller see the ApiError.
  if (profileRes.status === "rejected") throw profileRes.reason;

  const chessUsername =
    participantsRes.status === "fulfilled"
      ? (participantsRes.value[id]?.chess_username ?? null)
      : null;

  let standing: Standing = { status: "unavailable" };
  if (boardRes.status === "fulfilled") {
    const ranked = rankEntries(boardRes.value);
    const mine = ranked.find((e) => e.id === id);
    const truncated = boardRes.value.length >= LEADERBOARD_FETCH_LIMIT;

    if (mine) standing = { status: "ranked", rank: mine.rank, of: ranked.length, truncated };
    else if (truncated) standing = { status: "outside", limit: LEADERBOARD_FETCH_LIMIT };
  }

  return { profile: profileRes.value, chessUsername, standing };
}
