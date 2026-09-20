import { Link } from "react-router-dom";
import type { ChallengeRecord } from "../lib/challenges";

interface Props {
  challenge: ChallengeRecord;
  meId: number;
  challengerName: string;
  defenderName: string;
}

export function MatchOutcome({ challenge, meId, challengerName, defenderName }: Props) {
  const source =
    challenge.result_source === "auto"
      ? "Confirmed automatically from your Chess.com games."
      : challenge.result_source === "self_reported"
        ? "Both players reported the same result."
        : null;

  if (challenge.status === "void") {
    return (
      <div className="panel flex flex-col items-center gap-3 p-8 text-center" role="status">
        <span className="font-display text-3xl text-steel-400" aria-hidden>
          ♟
        </span>
        <h2 className="font-display text-2xl text-parchment-50">Match aborted, challenge cancelled</h2>
        <p className="max-w-md text-sm text-steel-400">
          The match was abandoned before it began. Both vaults are exactly as they were.
        </p>
        {source && <p className="text-xs text-steel-500">{source}</p>}
        <Link to="/challenges" className="btn-gold mt-2">
          Back to the Challenge Arena
        </Link>
      </div>
    );
  }

  if (challenge.status === "draw") {
    return (
      <div className="panel flex flex-col items-center gap-3 p-8 text-center" role="status">
        <span className="font-display text-4xl text-steel-400" aria-hidden>
          🤝
        </span>
        <h2 className="font-display text-2xl text-parchment-50">Match drawn</h2>
        <p className="max-w-md text-sm text-steel-400">
          A hard-fought draw. Neither service changed hands. Both vaults are exactly as they were.
        </p>
        {source && <p className="text-xs text-steel-500">{source}</p>}
        <Link to="/challenges" className="btn-gold mt-2">
          Back to the Challenge Arena
        </Link>
      </div>
    );
  }

  const winnerIsChallenger = challenge.winner_id === challenge.challenger_id;
  const winnerName = winnerIsChallenger ? challengerName : defenderName;
  const loserName = winnerIsChallenger ? defenderName : challengerName;
  // The winner collects the *loser's* wagered service.
  const movedService = winnerIsChallenger ? challenge.defender_service : challenge.challenger_service;

  const isParticipant = meId === challenge.challenger_id || meId === challenge.defender_id;
  const iWon = challenge.winner_id === meId;

  const heading = iWon ? "You won" : isParticipant ? "You lost this one" : "Match complete";
  const detail = iWon ? (
    <>
      <span className="text-parchment-100">{movedService}</span> from {loserName} has been added to your bank.
    </>
  ) : isParticipant ? (
    <>
      {winnerName} collected your <span className="text-parchment-100">{movedService}</span>.
    </>
  ) : (
    <>
      {winnerName} won <span className="text-parchment-100">{movedService}</span> from {loserName}.
    </>
  );

  return (
    <div
      className={`panel flex flex-col items-center gap-3 p-8 text-center ${iWon ? "border-felt-500" : ""}`}
      role="status"
    >
      <span className={`font-display text-4xl ${iWon ? "text-gold-400" : "text-steel-400"}`} aria-hidden>
        {iWon ? "♛" : "♟"}
      </span>
      <h2 className="font-display text-2xl text-parchment-50">{heading}</h2>
      <p className="max-w-md text-sm text-steel-400">{detail}</p>
      {source && <p className="text-xs text-steel-500">{source}</p>}

      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {iWon ? (
          <Link to="/bank" className="btn-gold">
            See it in your bank
          </Link>
        ) : (
          <Link to="/vault" className="btn-gold">
            Back to your vault
          </Link>
        )}
        <Link to="/challenges" className="btn-ghost">
          Challenge Arena
        </Link>
      </div>
    </div>
  );
}
