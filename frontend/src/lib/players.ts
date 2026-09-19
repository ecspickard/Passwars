// Player browser data: merges GET /users/players (services offered) with
// GET /users/leaderboard (passwords collected) by user id, and holds the pure
// filter/sort logic so it can be reasoned about (and tested) apart from the UI.

import { api } from "./api";
import type { LeaderboardEntry, PlayerSummary } from "./types";

export interface Player extends PlayerSummary {
  /** Extended: the backend returns this only once the player's Chess.com
   * account is verified, so "has a value" means "linked and verified". */
  chess_username?: string | null;
  password_count: number;
}

export type PlayerSort = "most" | "fewest" | "username";

// The leaderboard endpoint defaults to the top 50; ask for enough that every
// player gets a real count instead of silently falling back to 0.
const LEADERBOARD_LIMIT = 500;

export async function fetchPlayers(): Promise<Player[]> {
  const [players, board] = await Promise.all([
    api.get<(PlayerSummary & { chess_username?: string | null })[]>("/users/players"),
    api.get<LeaderboardEntry[]>(`/users/leaderboard?limit=${LEADERBOARD_LIMIT}`),
  ]);
  const counts = new Map(board.map((entry) => [entry.id, entry.password_count]));
  return players.map((p) => ({ ...p, password_count: counts.get(p.id) ?? 0 }));
}

export function serviceMatches(service: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  return q !== "" && service.toLowerCase().includes(q);
}

export function filterAndSortPlayers(
  players: Player[],
  { service, sort }: { service: string; sort: PlayerSort },
): Player[] {
  const q = service.trim();
  const filtered = q
    ? players.filter((p) => p.services.some((s) => serviceMatches(s, q)))
    : [...players];

  const byName = (a: Player, b: Player) =>
    a.username.localeCompare(b.username, undefined, { sensitivity: "base" });

  filtered.sort((a, b) => {
    if (sort === "username") return byName(a, b);
    const diff = sort === "most" ? b.password_count - a.password_count : a.password_count - b.password_count;
    return diff || byName(a, b);
  });
  return filtered;
}
