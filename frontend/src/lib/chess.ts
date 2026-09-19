import { api } from "./api";

export interface ChessComPublicProfile {
  username: string;
  name?: string;
  avatar?: string;
  url: string;
}

export type ChessLookupResult =
  | { status: "found"; profile: ChessComPublicProfile }
  | { status: "not_found" }
  | { status: "network_error" };

/**
 * Client-side sanity check against Chess.com's public, unauthenticated API
 * (https://www.chess.com/news/view/published-data-api). This only confirms
 * the handle *exists* and fetches a nice avatar/name for the confirmation
 * card — it proves nothing about ownership. Ownership is proven afterward
 * by startChessLink/verifyChessLink, which asks the user to paste a code
 * into their Chess.com profile.
 */
export async function lookupChessComPlayer(username: string): Promise<ChessLookupResult> {
  const handle = username.trim();
  if (!handle) return { status: "not_found" };

  try {
    const res = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(handle)}`);
    if (res.status === 404) return { status: "not_found" };
    if (!res.ok) return { status: "network_error" };
    const data = await res.json();
    return {
      status: "found",
      profile: { username: data.username, name: data.name, avatar: data.avatar, url: data.url },
    };
  } catch {
    // Covers offline, DNS failure, and a CORS block — all indistinguishable
    // from the browser, so they get the same "can't reach Chess.com" copy.
    return { status: "network_error" };
  }
}

export interface ChessLinkStartResponse {
  chess_username: string;
  verification_code: string;
  instructions: string;
}

export interface ChessLinkVerifyResponse {
  chess_username: string;
  verified: boolean;
  verified_at: string | null;
}

export const startChessLink = (chess_username: string) =>
  api.post<ChessLinkStartResponse>("/users/chess-username/start", { chess_username });

export const verifyChessLink = () =>
  api.post<ChessLinkVerifyResponse>("/users/chess-username/verify");

/** Needs the DELETE /api/users/chess-username route (see routes_users.py). */
export const unlinkChessAccount = () => api.delete<void>("/users/chess-username");
