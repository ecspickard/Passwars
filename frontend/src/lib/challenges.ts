// Challenge records as returned by the backend (see ChallengeResponse in
// schemas.py). Kept separate from the older `Challenge` type in types.ts,
// which doesn't match the backend's real shape.

import { api } from "./api";

export interface ChallengeRecord {
  id: number;
  challenger_id: number;
  defender_id: number;
  /** Only filled in by GET /challenges/mine or /recent; null/empty on GET /challenges/{id}. */
  challenger_name: string;
  defender_name: string | null;
  challenger_service: string;
  defender_service: string;
  /** "pending" | "accepted" | "completed" | "rejected" | "expired" | "void" */
  status: string;
  accepted_at: string | null;
  // Present on GET /challenges/{id} (ChallengeResponse in schemas.py).
  winner_id?: number | null;
  result_source?: "auto" | "self_reported" | null;
  created_at?: string;
}

/** Needs the GET /api/challenges/mine route (see PROMPT6_BACKEND_CHANGES.md).
 * Returns only the current user's pending and accepted challenges. */
export const listMyChallenges = () => api.get<ChallengeRecord[]>("/challenges/mine");

export const fetchRecentChallenges = () => api.get<ChallengeRecord[]>("/challenges/recent");

/** Any challenge the current user is part of, whatever its status. */
export const getChallenge = (id: number) => api.get<ChallengeRecord>(`/challenges/${id}`);

export interface Participant {
  id: number;
  username: string;
  /** Only present once the player's Chess.com account is verified. */
  chess_username: string | null;
}

/**
 * Resolves usernames and verified Chess.com handles for the given user ids.
 * There's no "get user by id" endpoint that includes the Chess.com handle,
 * so this reads the public players list (which only exposes verified handles).
 */
export async function lookupParticipants(ids: number[]): Promise<Record<number, Participant>> {
  const players = await api.get<
    { id: number; username: string; chess_username?: string | null }[]
  >("/users/players");

  const wanted = new Set(ids);
  const result: Record<number, Participant> = {};
  for (const p of players) {
    if (wanted.has(p.id)) {
      result[p.id] = { id: p.id, username: p.username, chess_username: p.chess_username ?? null };
    }
  }
  return result;
}
