import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { MatchInProgress } from "../components/MatchInProgress";
import { MatchOutcome } from "../components/MatchOutcome";
import { PageHeading } from "../components/PageHeading";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../hooks/useWebSocket";
import { ApiError } from "../lib/api";
import {
  getChallenge,
  lookupParticipants,
  type ChallengeRecord,
  type Participant,
} from "../lib/challenges";

// Events after which this page's challenge may have changed.
const REFRESH_EVENTS = [
  "challenge_accepted",
  "challenge_denied",
  "challenge_expired",
  "challenge_voided",
  "game_ended",
];

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  pending: { text: "Awaiting reply", className: "border-gold-500/40 text-gold-400" },
  accepted: { text: "In progress", className: "border-gold-500 text-gold-400" },
  completed: { text: "Resolved", className: "border-felt-500 text-felt-500" },
  void: { text: "Voided", className: "border-steel-500 text-steel-400" },
  rejected: { text: "Declined", className: "border-signal-500 text-signal-500" },
  expired: { text: "Expired", className: "border-steel-500 text-steel-400" },
};

export default function ChallengeDetail() {
  const { id } = useParams<{ id: string }>();
  const challengeId = Number(id);
  const { user } = useAuth();
  const { send, subscribe, isConnected } = useWebSocket();

  const [challenge, setChallenge] = useState<ChallengeRecord | null>(null);
  const [people, setPeople] = useState<Record<number, Participant>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isInteger(challengeId)) {
      setLoadError("That challenge address isn't valid.");
      return;
    }
    try {
      setChallenge(await getChallenge(challengeId));
      setLoadError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setLoadError(
          err.status === 404
            ? "We couldn't find that challenge."
            : err.status === 403
              ? "This challenge is between other players."
              : err.message,
        );
      } else {
        setLoadError("Couldn't load this challenge.");
      }
    }
  }, [challengeId]);

  useEffect(() => {
    setChallenge(null);
    setLoadError(null);
    load();
  }, [load]);

  // Live updates: refetch whenever an event for *this* challenge arrives.
  useEffect(() => {
    const offs = REFRESH_EVENTS.map((type) =>
      subscribe(type, (event) => {
        if (Number(event.challenge_id) === challengeId) load();
      }),
    );
    return () => offs.forEach((off) => off());
  }, [subscribe, challengeId, load]);

  // Names and verified Chess.com handles. Re-read when the status changes so a
  // handle linked in the meantime is picked up before the game starts.
  const challengerId = challenge?.challenger_id;
  const defenderId = challenge?.defender_id;
  const status = challenge?.status;
  useEffect(() => {
    if (challengerId === undefined || defenderId === undefined) return;
    let cancelled = false;
    lookupParticipants([challengerId, defenderId])
      .then((p) => {
        if (!cancelled) setPeople(p);
      })
      .catch(() => {
        /* names fall back to the challenge record / "Player #id" */
      });
    return () => {
      cancelled = true;
    };
  }, [challengerId, defenderId, status]);

  // A status change means the server answered whatever we were waiting on.
  useEffect(() => {
    setIsActing(false);
  }, [status]);

  if (!user) return null;

  if (!challenge) {
    return loadError ? (
      <div>
        <PageHeading title="Challenge" />
        <div className="panel flex flex-col items-center gap-3 p-8 text-center text-steel-400">
          <p>{loadError}</p>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={load}>
              Try again
            </button>
            <Link to="/challenges" className="btn-gold">
              Challenge Arena
            </Link>
          </div>
        </div>
      </div>
    ) : (
      <div className="flex h-[40vh] items-center justify-center">
        <p className="font-display text-steel-400">Setting up the board…</p>
      </div>
    );
  }

  const nameOf = (uid: number) =>
    people[uid]?.username ??
    ((uid === challenge.challenger_id && challenge.challenger_name) || `Player #${uid}`);
  const chessOf = (uid: number) => people[uid]?.chess_username ?? null;

  const isChallenger = user.id === challenge.challenger_id;
  const isDefender = user.id === challenge.defender_id;
  const opponentId = isChallenger ? challenge.defender_id : challenge.challenger_id;
  const ownVerified = Boolean(user.chess_username && user.chess_verified_at);
  const badge = STATUS_LABEL[challenge.status] ?? {
    text: challenge.status,
    className: "border-ink-700 text-steel-400",
  };

  const handleAccept = () => {
    send({ type: "accept_challenge", challenge_id: challenge.id });
    setIsActing(true);
    setTimeout(() => setIsActing(false), 5_000);
  };

  const handleDecline = () => {
    send({ type: "deny_challenge", challenge_id: challenge.id });
    // The server only notifies the challenger of a decline, so update locally.
    setChallenge((c) => (c ? { ...c, status: "rejected" } : c));
    setTimeout(load, 1_000);
  };

  const winnerId = challenge.status === "completed" ? challenge.winner_id : null;

  let body: ReactNode;
  switch (challenge.status) {
    case "pending":
      body = isDefender ? (
        <div className="panel flex flex-col gap-3 p-5">
          <h2 className="font-display text-lg text-parchment-50">
            {nameOf(challenge.challenger_id)} challenged you
          </h2>
          <p className="text-sm text-steel-400">
            Accept to play them on Chess.com. Win and you collect their{" "}
            <span className="text-parchment-100">{challenge.challenger_service}</span>; lose and they
            collect your <span className="text-parchment-100">{challenge.defender_service}</span>.
          </p>
          {!ownVerified && (
            <p role="alert" className="rounded-panel border border-gold-500/40 bg-gold-500/5 px-3 py-2 text-sm">
              Link and verify your Chess.com account before you accept.{" "}
              <Link to="/settings" className="text-gold-400 hover:underline">
                Go to settings
              </Link>
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={handleDecline} disabled={!isConnected}>
              Decline
            </button>
            <button
              type="button"
              className="btn-gold"
              onClick={handleAccept}
              disabled={!ownVerified || !isConnected || isActing}
            >
              {isActing ? "Accepting…" : "Accept challenge"}
            </button>
          </div>
        </div>
      ) : (
        <div className="panel flex flex-col gap-2 p-5" role="status">
          <h2 className="font-display text-lg text-parchment-50">
            Waiting for {nameOf(challenge.defender_id)} to accept
          </h2>
          <p className="text-sm text-steel-400">
            This page updates the moment they respond. An unanswered challenge expires after an hour.
          </p>
        </div>
      );
      break;

    case "accepted":
      body = (isChallenger || isDefender) ? (
        <MatchInProgress
          challenge={challenge}
          meId={user.id}
          opponentId={opponentId}
          opponentName={nameOf(opponentId)}
          challengerChess={chessOf(challenge.challenger_id)}
          defenderChess={chessOf(challenge.defender_id)}
          onRefresh={load}
        />
      ) : (
        <Note title="Match in progress">These players are playing their game on Chess.com.</Note>
      );
      break;

    case "completed":
    case "void":
      body = (
        <MatchOutcome
          challenge={challenge}
          meId={user.id}
          challengerName={nameOf(challenge.challenger_id)}
          defenderName={nameOf(challenge.defender_id)}
        />
      );
      break;

    case "rejected":
      body = (
        <Note title="Challenge declined">
          {isChallenger
            ? `${nameOf(challenge.defender_id)} declined this challenge.`
            : isDefender
              ? "You declined this challenge."
              : "This challenge was declined."}{" "}
          Nothing changed hands.
        </Note>
      );
      break;

    case "expired":
      body = (
        <Note title="Challenge expired">
          It went unanswered for an hour, so it was closed. Nothing changed hands.
        </Note>
      );
      break;

    default:
      body = <Note title="Status unknown">This challenge is marked &ldquo;{challenge.status}&rdquo;.</Note>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeading
          title={`Challenge #${challenge.id}`}
          description={`${nameOf(challenge.challenger_id)} vs ${nameOf(challenge.defender_id)}, played on Chess.com.`}
        />
        <span className={`rounded-panel border px-2.5 py-1 text-xs font-medium ${badge.className}`}>
          {badge.text}
        </span>
      </div>

      <section aria-label="Players and stakes">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <PlayerSide
            role="Challenger"
            userId={challenge.challenger_id}
            name={nameOf(challenge.challenger_id)}
            isMe={user.id === challenge.challenger_id}
            chess={chessOf(challenge.challenger_id)}
            service={challenge.challenger_service}
            isWinner={winnerId === challenge.challenger_id}
          />
          <span className="self-center font-display text-steel-400" aria-hidden>
            vs
          </span>
          <PlayerSide
            role="Defender"
            userId={challenge.defender_id}
            name={nameOf(challenge.defender_id)}
            isMe={user.id === challenge.defender_id}
            chess={chessOf(challenge.defender_id)}
            service={challenge.defender_service}
            isWinner={winnerId === challenge.defender_id}
          />
        </div>
        <p className="mt-2 text-xs text-steel-500">The winner collects the other player&rsquo;s wagered service.</p>
      </section>

      {body}
    </div>
  );
}

function PlayerSide({
  role,
  userId,
  name,
  isMe,
  chess,
  service,
  isWinner,
}: {
  role: string;
  userId: number;
  name: string;
  isMe: boolean;
  chess: string | null;
  service: string;
  isWinner: boolean;
}) {
  return (
    <div className={`panel flex flex-1 flex-col gap-3 p-4 ${isWinner ? "border-felt-500" : ""}`}>
      <div>
        <p className="text-xs text-steel-400">
          {role}
          {isMe && ", you"}
        </p>
        <Link
          to={`/profile/${userId}`}
          className="break-words font-display text-lg text-parchment-50 hover:text-gold-400"
        >
          {name}
        </Link>
      </div>
      <p className="text-sm">
        {chess ? (
          <a
            href={`https://www.chess.com/member/${encodeURIComponent(chess)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold-400 hover:underline"
          >
            ♞ @{chess}
          </a>
        ) : (
          <span className="text-steel-500">No verified Chess.com account</span>
        )}
      </p>
      <div className="mt-auto rounded-panel border border-ink-700 p-3">
        <p className="text-xs text-steel-400">Wagers</p>
        <p className="break-words text-parchment-50">{service}</p>
      </div>
    </div>
  );
}

function Note({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="panel flex flex-col items-center gap-3 p-8 text-center" role="status">
      <h2 className="font-display text-xl text-parchment-50">{title}</h2>
      <p className="max-w-md text-sm text-steel-400">{children}</p>
      <Link to="/challenges" className="btn-ghost mt-1">
        Back to the Challenge Arena
      </Link>
    </div>
  );
}
