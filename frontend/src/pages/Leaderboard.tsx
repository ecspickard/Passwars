import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeading } from "../components/PageHeading";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";
import {
  DEFAULT_LEADERBOARD_LIMIT,
  LEADERBOARD_PAGE_SIZE,
  fetchLeaderboard,
} from "../lib/leaderboard";
import type { LeaderboardEntry } from "../lib/types";

const CHESS_RANK: Record<number, { icon: string; className: string }> = {
  1: { icon: "♔", className: "text-gold-400 text-xl drop-shadow-sm inline-block" },
  2: { icon: "♕", className: "text-gold-400 text-lg inline-block" },
  3: { icon: "♗", className: "text-gold-500 text-lg inline-block" },
};

export default function Leaderboard() {
  const { user } = useAuth();
  const isMac = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('mac');

  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [limit, setLimit] = useState(DEFAULT_LEADERBOARD_LIMIT);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const load = async (nextLimit: number) => {
    setLoadError(null);
    try {
      setEntries(await fetchLeaderboard(nextLimit));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Couldn't load the leaderboard.");
    }
  };

  useEffect(() => {
    load(DEFAULT_LEADERBOARD_LIMIT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleShowMore = async () => {
    const nextLimit = limit + LEADERBOARD_PAGE_SIZE;
    setIsLoadingMore(true);
    await load(nextLimit);
    setLimit(nextLimit);
    setIsLoadingMore(false);
  };

  const handleRetry = () => load(limit);

  // No total count comes back from the API, so "there might be more" is
  // inferred from getting back exactly as many rows as we asked for.
  const mightHaveMore = entries !== null && entries.length === limit;

  const myRankIndex = useMemo(
    () => (user && entries ? entries.findIndex((e) => e.id === user.id) : -1),
    [entries, user],
  );

  return (
    <div>
      <PageHeading title="Leaderboard" description="Ranked by passwords collected" />

      {loadError && (
        <div className="panel mb-4 border-signal-500 p-4 text-sm text-signal-500">
          {loadError}{" "}
          <button type="button" className="underline" onClick={handleRetry}>
            Try again
          </button>
        </div>
      )}

      {entries === null && !loadError ? (
        <div className="panel p-8 text-center text-steel-400">Tallying the standings…</div>
      ) : entries && entries.length === 0 ? (
        <div className="panel p-8 text-center text-steel-400">No players yet.</div>
      ) : entries ? (
        <>
          <div className="panel overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-700 text-xs uppercase tracking-wider text-steel-500">
                  <th className="px-4 py-3 font-medium">Rank</th>
                  <th className="px-4 py-3 font-medium">Player</th>
                  <th className="px-4 py-3 text-right font-medium">Passwords</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700/50">
                {entries.map((entry, i) => {
                  const rank = i + 1;
                  const isMe = user?.id === entry.id;
                  const chessRank = CHESS_RANK[rank];
                  return (
                    <tr key={entry.id} className={isMe ? "bg-gold-500/10" : undefined}>
                      <td className="px-4 py-3 font-display text-parchment-50">
                        <span className="text-steel-400 mr-2 font-ui text-sm">#{rank}</span>
                        {chessRank && (
                          <span aria-hidden className={`${chessRank.className} ${isMac ? '-translate-y-px' : ''}`} title={`Rank ${rank}`}>{chessRank.icon}</span>
                        )}
                        {chessRank && <span className="sr-only">Rank {rank}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/profile/${entry.id}`}
                          className={`hover:text-gold-400 ${
                            isMe ? "font-semibold text-gold-400" : "text-parchment-100"
                          }`}
                        >
                          {entry.username}
                        </Link>
                        {isMe && <span className="ml-2 text-xs text-steel-400">(you)</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-parchment-100">
                        {entry.password_count}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {user && myRankIndex === -1 && (
            <p className="mt-3 text-xs text-steel-400">
              You&rsquo;re not in the top {entries.length} yet — keep collecting to climb on.
            </p>
          )}

          {mightHaveMore && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                className="btn-ghost"
                onClick={handleShowMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? "Loading…" : "Show more"}
              </button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
