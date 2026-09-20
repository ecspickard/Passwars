import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChallengeModal } from "../components/ChallengeModal";
import { PageHeading } from "../components/PageHeading";
import { PlayerCard, type Outstanding } from "../components/PlayerCard";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../hooks/useWebSocket";
import { ApiError } from "../lib/api";
import { listMyChallenges, type ChallengeRecord } from "../lib/challenges";
import { fetchPlayers, filterAndSortPlayers, type Player, type PlayerSort } from "../lib/players";

// Events after which our list of outstanding challenges may have changed.
const REFRESH_EVENTS = ["challenge_received", "challenge_accepted", "challenge_denied", "game_ended"];

export default function Challenges() {
  const { user } = useAuth();
  const { subscribe, send } = useWebSocket();
  const [searchParams, setSearchParams] = useSearchParams();

  const [players, setPlayers] = useState<Player[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyLinked, setOnlyLinked] = useState(false);
  const [sort, setSort] = useState<PlayerSort>("most");
  const [challenging, setChallenging] = useState<Player | null>(null);

  // Outstanding challenges: the server's list, plus defender ids we've just
  // challenged that the server list hasn't confirmed yet (send_challenge has
  // no acknowledgement event, so the card flips to "sent" optimistically).
  const [outstanding, setOutstanding] = useState<ChallengeRecord[]>([]);
  const [justSentTo, setJustSentTo] = useState<number[]>([]);

  const myId = user?.id;
  const ownVerified = Boolean(user?.chess_username && user?.chess_verified_at);

  const loadPlayers = useCallback(async () => {
    setLoadError(null);
    try {
      setPlayers(await fetchPlayers());
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Couldn't load players.");
    }
  }, []);

  const refreshOutstanding = useCallback(async () => {
    try {
      setOutstanding(await listMyChallenges());
      setJustSentTo([]); // the server list is authoritative again
    } catch {
      // Pending badges are a nicety; keep whatever we have if this fails.
    }
  }, []);

  useEffect(() => {
    loadPlayers();
    refreshOutstanding();
  }, [loadPlayers, refreshOutstanding]);

  useEffect(() => {
    const unsubscribers = REFRESH_EVENTS.map((type) => subscribe(type, () => refreshOutstanding()));
    return () => unsubscribers.forEach((off) => off());
  }, [subscribe, refreshOutstanding]);

  const outstandingByPlayer = useMemo(() => {
    const map = new Map<number, Outstanding>();
    for (const c of outstanding) {
      const otherId = c.challenger_id === myId ? c.defender_id : c.challenger_id;
      if (map.get(otherId)?.kind === "active") continue;
      if (c.status === "accepted") map.set(otherId, { kind: "active", challengeId: c.id });
      else map.set(otherId, c.challenger_id === myId ? { kind: "sent" } : { kind: "received", challengeId: c.id });
    }
    for (const id of justSentTo) if (!map.has(id)) map.set(id, { kind: "sent" });
    return map;
  }, [outstanding, justSentTo, myId]);

  // You can't challenge yourself, or someone with nothing to win.
  const eligible = useMemo(
    () => (players ?? []).filter((p) => p.id !== myId && p.services.length > 0),
    [players, myId],
  );

  // Deep-link support: a link like /challenges?opponent=42 (from the
  // leaderboard or a profile page) opens the challenge modal pre-filled
  // with that player, once the player list has loaded. The param is then
  // cleared so closing/reopening the modal, or any later re-render, doesn't
  // reopen it again.
  useEffect(() => {
    const opponentParam = searchParams.get("opponent");
    if (!opponentParam || players === null) return;

    const opponentId = Number(opponentParam);
    const target = eligible.find((p) => p.id === opponentId);
    if (target) setChallenging(target);

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("opponent");
        return next;
      },
      { replace: true },
    );
  }, [players, eligible, searchParams, setSearchParams]);

  const visible = useMemo(
    () => filterAndSortPlayers(eligible, { query: searchQuery, onlyLinked, sort }),
    [eligible, searchQuery, onlyLinked, sort],
  );

  const handleSent = (defenderId: number) => {
    setJustSentTo((prev) => [...prev, defenderId]);
    setChallenging(null);
    // Give the server a moment to persist it, then pull the real record.
    setTimeout(refreshOutstanding, 1500);
  };

  if (!user) return null;

  return (
    <div>
      <PageHeading
        title="Challenge Arena"
        description="Find a player, pick the service you want off them, and challenge them to a Chess.com game"
      />

      {!ownVerified && (
        <div className="panel mb-4 flex flex-wrap items-center justify-between gap-3 border-gold-500/40 p-4 text-sm">
          <p className="text-parchment-100">
            Link and verify a Chess.com account to send challenges. You can still browse players.
          </p>
          <Link to="/settings" className="btn-gold">
            Go to settings
          </Link>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Search username or service…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field max-w-xs"
            aria-label="Search players by username or service"
          />
          <label className="flex items-center gap-2 text-sm text-parchment-100">
            <input
              type="checkbox"
              checked={onlyLinked}
              onChange={(e) => setOnlyLinked(e.target.checked)}
              className="rounded border-ink-700 bg-ink-900 text-gold-500 focus:ring-gold-500"
            />
            Only linked accounts
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-steel-400">
          Sort by
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as PlayerSort)}
            className="input-field w-auto"
          >
            <option value="most">Most passwords collected</option>
            <option value="fewest">Fewest passwords collected</option>
            <option value="username">Username (A–Z)</option>
          </select>
        </label>
      </div>

      {loadError && (
        <div className="panel mb-4 border-signal-500 p-4 text-sm text-signal-500">
          {loadError}{" "}
          <button type="button" className="underline" onClick={loadPlayers}>
            Try again
          </button>
        </div>
      )}

      {players === null && !loadError ? (
        <div className="panel p-8 text-center text-steel-400">Finding players…</div>
      ) : players && eligible.length === 0 ? (
        <div className="panel p-8 text-center text-steel-400">
          No other players have staked a service yet. Check back soon.
        </div>
      ) : players && visible.length === 0 ? (
        <div className="panel flex flex-col items-center gap-3 p-8 text-center text-steel-400">
          <p>No players found matching your filters.</p>
          <button type="button" className="btn-ghost" onClick={() => { setSearchQuery(""); setOnlyLinked(false); }}>
            Clear filters
          </button>
        </div>
      ) : players ? (
        <>
          <p className="mb-3 text-xs text-steel-400" aria-live="polite">
            Showing {visible.length} of {eligible.length} players
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                serviceFilter={searchQuery}
                outstanding={outstandingByPlayer.get(player.id)}
                onChallenge={() => setChallenging(player)}
                onAccept={(challengeId) => send({ type: "accept_challenge", challenge_id: challengeId })}
                onDecline={(challengeId) => send({ type: "deny_challenge", challenge_id: challengeId })}
              />
            ))}
          </div>
        </>
      ) : null}

      {challenging && (
        <ChallengeModal
          me={user}
          opponent={challenging}
          onClose={() => setChallenging(null)}
          onSent={handleSent}
        />
      )}
    </div>
  );
}
