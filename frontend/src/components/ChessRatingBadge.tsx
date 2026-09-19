import { useEffect, useState } from "react";
import { getChessRating, type RatingResult } from "../lib/chessRating";

const BADGE = "inline-flex shrink-0 items-center gap-1.5 rounded-panel border px-2 py-0.5 text-xs";

export function ChessRatingBadge({ username }: { username?: string | null }) {
  const [result, setResult] = useState<RatingResult | null>(null);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    setResult(null);
    getChessRating(username).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [username]);

  if (!username) {
    return (
      <span
        className={`${BADGE} border-ink-700 text-steel-500`}
        title="This player hasn't linked a verified Chess.com account"
      >
        Not linked
      </span>
    );
  }

  if (result === null) {
    return <span className={`${BADGE} border-ink-700 text-steel-500`}>Rating…</span>;
  }

  if (result.status === "ok") {
    // macOS often renders the Unicode knight slightly lower than Windows
    const isMac = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('mac');
    return (
      <span
        className={`${BADGE} border-gold-500/40 text-steel-400`}
        title={`${result.format} rating for ${username} on Chess.com`}
      >
        <span aria-hidden className={`text-gold-400 ${isMac ? '-translate-y-0.5' : ''}`}>
          ♞
        </span>
        <span className="font-medium text-gold-400">{result.rating}</span>
        {result.format}
      </span>
    );
  }

  return (
    <span
      className={`${BADGE} border-ink-700 text-steel-500`}
      title={result.status === "unrated" ? "No rated games yet" : "Couldn't reach Chess.com"}
    >
      {result.status === "unrated" ? "Unrated" : "Rating unavailable"}
    </span>
  );
}
