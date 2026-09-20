// Finds the result of a game between two Chess.com players, using the public
// monthly game archives (https://www.chess.com/news/view/published-data-api).
//
// Mirrors find_game_result() in the backend's chess_api.py so the browser and
// the server poller agree on what counts as "the game".

/**
 * What to do when the two players draw.
 *  - "void":         a draw voids the challenge (no transfer). Default.
 *  - "keep_waiting": ignore draws and keep looking for a decisive game
 *                    (e.g. so the players can play a tiebreak).
 * Change this one constant to switch behavior.
 */
export const DRAW_POLICY: "void" | "keep_waiting" = "void";

const CHESS_API = "https://api.chess.com/pub";

// Chess.com's result codes for a drawn game.
const DRAW_RESULTS = new Set([
  "agreed",
  "repetition",
  "stalemate",
  "insufficient",
  "50move",
  "timevsinsufficient",
]);

export type MatchResult =
  | { kind: "none" }
  | { kind: "decisive"; winnerUsername: string; endTime: number; url?: string }
  | { kind: "draw"; endTime: number; url?: string };

export type FoundResult = Exclude<MatchResult, { kind: "none" }>;

/** The archive endpoints couldn't be reached (network, CORS, rate limit, 5xx). */
export class ChessApiError extends Error {}

/**
 * The backend serializes naive UTC datetimes ("2026-09-19T12:00:00", no
 * zone). `new Date()` would read that as *local* time, so pin it to UTC.
 * Returns epoch milliseconds.
 */
export function parseServerTimestamp(value: string): number {
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  return new Date(hasZone ? value : `${value}Z`).getTime();
}

interface ChessGame {
  url?: string;
  end_time?: number;
  white?: { username?: string; result?: string };
  black?: { username?: string; result?: string };
  rated?: boolean;
  rules?: string;
  time_class?: string;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ChessApiError("Couldn't reach Chess.com");
  }
  // Unknown player / no archives yet: not an error, just nothing to find.
  if (res.status === 404) return null;
  if (!res.ok) throw new ChessApiError(`Chess.com responded with ${res.status}`);
  return (await res.json()) as T;
}

/** This player's most recent monthly game lists, from the acceptance month on. */
async function gamesFor(username: string, sinceMs: number, signal?: AbortSignal): Promise<ChessGame[]> {
  const index = await getJson<{ archives?: string[] }>(
    `${CHESS_API}/player/${encodeURIComponent(username)}/games/archives`,
    signal,
  );

  const since = new Date(sinceMs);
  const sinceKey = `${since.getUTCFullYear()}/${String(since.getUTCMonth() + 1).padStart(2, "0")}`;
  // Archive URLs end in .../games/YYYY/MM, which sorts correctly as a string.
  // Two months covers a game that spans a month boundary.
  const urls = (index?.archives ?? []).filter((u) => u.slice(-7) >= sinceKey).slice(-2);

  const months = await Promise.all(urls.map((u) => getJson<{ games?: ChessGame[] }>(u, signal)));
  return months.flatMap((m) => m?.games ?? []);
}

/**
 * Looks for a finished game between the two accounts that ended at or after
 * `sinceMs` (the challenge's accepted_at). Returns the most recent one.
 * Throws ChessApiError only if Chess.com couldn't be reached for *both* players.
 */
export async function findMatchResult(
  expectedWhiteUsername: string,
  expectedBlackUsername: string,
  sinceMs: number,
  signal?: AbortSignal,
): Promise<MatchResult> {
  const whitePlayer = expectedWhiteUsername.toLowerCase();
  const blackPlayer = expectedBlackUsername.toLowerCase();

  const effectiveSinceMs = sinceMs - 60_000;

  const settled = await Promise.allSettled([
    gamesFor(whitePlayer, effectiveSinceMs, signal),
    gamesFor(blackPlayer, effectiveSinceMs, signal),
  ]);

  if (settled.every((s) => s.status === "rejected")) {
    const reason = (settled[0] as PromiseRejectedResult).reason;
    throw reason instanceof Error ? reason : new ChessApiError("Couldn't reach Chess.com");
  }

  const games = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
  const seen = new Set<string>();
  let best: FoundResult | null = null;

  for (const game of games) {
    const endMs = (game.end_time ?? 0) * 1000;
    if (endMs < effectiveSinceMs) continue;

    // Enforce Fair Play Rules (rated or unrated both count)
    if (game.rules !== "chess") continue;
    if (game.time_class !== "blitz" && game.time_class !== "rapid") continue;

    const white = (game.white?.username ?? "").toLowerCase();
    const black = (game.black?.username ?? "").toLowerCase();
    if (white !== whitePlayer || black !== blackPlayer) continue;

    // Both players' archives contain the same game; count it once.
    const key = game.url ?? `${endMs}-${white}-${black}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const whiteResult = game.white?.result ?? "";
    const blackResult = game.black?.result ?? "";

    let found: FoundResult | null = null;
    if (whiteResult === "win") {
      found = { kind: "decisive", winnerUsername: white, endTime: endMs, url: game.url };
    } else if (blackResult === "win") {
      found = { kind: "decisive", winnerUsername: black, endTime: endMs, url: game.url };
    } else if (DRAW_RESULTS.has(whiteResult) || DRAW_RESULTS.has(blackResult)) {
      found = { kind: "draw", endTime: endMs, url: game.url };
    }
    // Anything else (e.g. abandoned with no winner) isn't a usable result.

    if (found && (!best || found.endTime > best.endTime)) best = found;
  }

  return best ?? { kind: "none" };
}
