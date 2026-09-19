import { useEffect, useState } from "react";
import { getChessAvatar } from "../lib/chessAvatar";

/**
 * A player's Chess.com profile picture, imported from the public API.
 * Falls back to a plain pawn glyph when there's no linked/verified
 * account, no custom picture, or the lookup fails.
 */
export function ChessAvatar({
  username,
  size = 40,
}: {
  username?: string | null;
  size?: number;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);
    if (!username) return;
    let cancelled = false;
    getChessAvatar(username).then((r) => {
      if (!cancelled && r.status === "ok") setUrl(r.url);
    });
    return () => {
      cancelled = true;
    };
  }, [username]);

  const style = { width: size, height: size, fontSize: size * 0.5 };

  if (url) {
    return (
      <img
        src={url}
        alt=""
        style={style}
        className="shrink-0 rounded-full border border-ink-700 object-cover"
      />
    );
  }

  return (
    <span
      style={style}
      className="flex shrink-0 items-center justify-center rounded-full border border-ink-700 bg-ink-800 text-gold-400"
      aria-hidden
    >
      ♟
    </span>
  );
}
