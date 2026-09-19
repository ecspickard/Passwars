// Challenge records as returned by the backend (see ChallengeResponse in
// schemas.py). Kept separate from the older `Challenge` type in types.ts,
// which doesn't match the backend's real shape.

import { api } from "./api";

export interface ChallengeRecord {
  id: number;
  challenger_id: number;
  defender_id: number;
  challenger_service: string;
  defender_service: string;
  status: string; // "pending" | "accepted" | "completed" | "rejected"
  accepted_at: string | null;
}

/** Needs the GET /api/challenges/mine route (see PROMPT6_BACKEND_CHANGES.md).
 * Returns only the current user's pending and accepted challenges. */
export const listMyChallenges = () => api.get<ChallengeRecord[]>("/challenges/mine");
