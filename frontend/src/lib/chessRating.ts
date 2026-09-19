// Chess.com rating lookup for the player cards, via the public stats
// endpoint (https://api.chess.com/pub/player/{username}/stats).
//
// Results are cached per username for the session and concurrent requests are
// capped, so a page of 30 players doesn't open 30 simultaneous connections.
// Failed lookups are not cached, so remounting a card retries.

export type RatingFormat = "Rapid" | "Blitz" | "Bullet" | "Daily";

export type RatingResult =
  | { status: "ok"; format: RatingFormat; rating: number }
  | { status: "unrated" }
  | { status: "error" };

// One number per player keeps the badge readable: use the first format they
// actually have a rating in.
const FORMATS: [key: string, label: RatingFormat][] = [
  ["chess_rapid", "Rapid"],
  ["chess_blitz", "Blitz"],
  ["chess_bullet", "Bullet"],
  ["chess_daily", "Daily"],
];

const MAX_CONCURRENT = 4;
let active = 0;
const queue: (() => void)[] = [];

function schedule<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = () => {
      active += 1;
      task()
        .then(resolve, reject)
        .finally(() => {
          active -= 1;
          queue.shift()?.();
        });
    };
    if (active < MAX_CONCURRENT) run();
    else queue.push(run);
  });
}

async function fetchRating(username: string): Promise<RatingResult> {
  try {
    const res = await fetch(
      `https://api.chess.com/pub/player/${encodeURIComponent(username)}/stats`,
    );
    if (res.status === 404) return { status: "unrated" };
    if (!res.ok) return { status: "error" };
    const data = await res.json();
    for (const [key, format] of FORMATS) {
      const rating = data?.[key]?.last?.rating;
      if (typeof rating === "number") return { status: "ok", format, rating };
    }
    return { status: "unrated" };
  } catch {
    return { status: "error" };
  }
}

const cache = new Map<string, Promise<RatingResult>>();

export function getChessRating(username: string): Promise<RatingResult> {
  // Chess.com's API expects lowercase usernames.
  const key = username.toLowerCase();
  let pending = cache.get(key);
  if (!pending) {
    pending = schedule(() => fetchRating(key)).then((result) => {
      if (result.status === "error") cache.delete(key);
      return result;
    });
    cache.set(key, pending);
  }
  return pending;
}
