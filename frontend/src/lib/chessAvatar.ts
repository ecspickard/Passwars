// Chess.com avatar lookup for profile cards, via the public profile endpoint
// (https://api.chess.com/pub/player/{username}). Mirrors chessRating.ts's
// caching/concurrency approach so a page full of avatars doesn't open a
// pile of simultaneous connections.

export type AvatarResult =
  | { status: "ok"; url: string }
  | { status: "none" } // account exists but has no custom picture
  | { status: "error" };

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

async function fetchAvatar(username: string): Promise<AvatarResult> {
  try {
    const res = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}`);
    if (res.status === 404) return { status: "none" };
    if (!res.ok) return { status: "error" };
    const data = await res.json();
    if (typeof data?.avatar === "string" && data.avatar.length > 0) {
      return { status: "ok", url: data.avatar };
    }
    return { status: "none" };
  } catch {
    return { status: "error" };
  }
}

const cache = new Map<string, Promise<AvatarResult>>();

export function getChessAvatar(username: string): Promise<AvatarResult> {
  // Chess.com's API expects lowercase usernames.
  const key = username.toLowerCase();
  let pending = cache.get(key);
  if (!pending) {
    pending = schedule(() => fetchAvatar(key)).then((result) => {
      if (result.status === "error") cache.delete(key);
      return result;
    });
    cache.set(key, pending);
  }
  return pending;
}
