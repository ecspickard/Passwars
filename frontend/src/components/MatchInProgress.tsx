import { useEffect, useRef, useState } from "react";
import { POLL_INTERVAL_MS, useAutoResolve } from "../hooks/useAutoResolve";
import { useWebSocket, useWebSocketEvent, type WsEvent } from "../hooks/useWebSocket";
import type { ChallengeRecord } from "../lib/challenges";
import { parseServerTimestamp, type FoundResult } from "../lib/chessMatch";
import { ResultReportPanel, type ReportChoice } from "./ResultReportPanel";

interface Props {
  challenge: ChallengeRecord;
  meId: number;
  opponentId: number;
  opponentName: string;
  challengerChess: string | null;
  defenderChess: string | null;
  /** Re-fetch the challenge (used to pick up the resolved state). */
  onRefresh: () => void;
}

export function MatchInProgress({
  challenge,
  meId,
  opponentId,
  opponentName,
  challengerChess,
  defenderChess,
  onRefresh,
}: Props) {
  const { send, isConnected } = useWebSocket();
  const iAmChallenger = meId === challenge.challenger_id;
  const opponentChess = iAmChallenger ? defenderChess : challengerChess;

  const sinceMs = challenge.accepted_at ? parseServerTimestamp(challenge.accepted_at) : null;

  const [autoResult, setAutoResult] = useState<FoundResult | null>(null);
  const [submitted, setSubmitted] = useState<ReportChoice | null>(null);
  const [opponentReported, setOpponentReported] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [stalled, setStalled] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(true);
  const finalizedRef = useRef(false);

  const challengerIsWhite = challenge.id % 2 === 0;
  const expectedWhite = challengerIsWhite ? challengerChess : defenderChess;
  const expectedBlack = challengerIsWhite ? defenderChess : challengerChess;
  const iAmWhite = (iAmChallenger && challengerIsWhite) || (!iAmChallenger && !challengerIsWhite);
  const myColor = iAmWhite ? "White" : "Black";
  const opponentColor = iAmWhite ? "Black" : "White";

  const { phase, lastCheckedAt, restart } = useAutoResolve({
    expectedWhite,
    expectedBlack,
    sinceMs,
    onResult: setAutoResult,
  });

  const isThisChallenge = (e: WsEvent) => Number(e.challenge_id) === challenge.id;

  useWebSocketEvent("opponent_reported", (e) => {
    if (isThisChallenge(e)) setOpponentReported(true);
  });

  useWebSocketEvent("result_mismatch", (e) => {
    if (!isThisChallenge(e)) return;
    setMismatch(true);
    setSubmitted(null);
    setOpponentReported(false);
  });

  // A result found on Chess.com is sent exactly once, as soon as the socket is up.
  //  - Decisive: `game_end` with source "auto". The server re-verifies it.
  //  - Draw: filed as a normal report (winner_id null), so it still needs the
  //    opponent's matching report and can't be used to dodge a loss.
  useEffect(() => {
    if (!autoResult || finalizedRef.current || !isConnected) return;
    finalizedRef.current = true;

    if (autoResult.kind === "decisive") {
      const winnerId =
        autoResult.winnerUsername === challengerChess?.toLowerCase()
          ? challenge.challenger_id
          : challenge.defender_id;
      send({ type: "game_end", challenge_id: challenge.id, winner_id: winnerId, source: "auto" });
    } else {
      send({ type: "game_end", challenge_id: challenge.id, winner_id: null, source: "auto" });
      setSubmitted("draw");
    }

    // Pick up the resolved state; if the server never confirms, offer the manual path.
    setTimeout(onRefresh, 3_000);
    setTimeout(() => setStalled(true), 12_000);
  }, [autoResult, isConnected, send, challenge, challengerChess, onRefresh]);

  const handleSubmit = (choice: ReportChoice) => {
    const winnerId = choice === "me" ? meId : choice === "them" ? opponentId : null;
    send({ type: "report_result", challenge_id: challenge.id, winner_id: winnerId });
    setSubmitted(choice);
    setMismatch(false);
  };

  const autoUnavailable = phase === "disabled" || phase === "timed_out" || phase === "error";
  const manualVisible =
    showManual || autoUnavailable || stalled || submitted !== null || opponentReported || mismatch;

  const playUrl = opponentChess
    ? `https://www.chess.com/play/online/new?opponent=${encodeURIComponent(opponentChess)}`
    : "https://www.chess.com/play/online";
  const profileUrl = opponentChess
    ? `https://www.chess.com/member/${encodeURIComponent(opponentChess)}`
    : null;

  return (
    <div className="flex flex-col gap-4">
      <section className="panel flex flex-col gap-4 p-5">
        <div>
          <h2 className="font-display text-lg text-parchment-50">Play the match on Chess.com</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-steel-400">
            <li>
              Open Chess.com and start a <strong className="text-parchment-100">Rated Blitz or Rapid</strong> game against{" "}
              <span className="text-parchment-100">{opponentName}</span>
              {opponentChess && (
                <>
                  {" "}
                  (<span className="text-parchment-100">@{opponentChess}</span>)
                </>
              )}
              . One of you sends the challenge and the other accepts it.
            </li>
            <li>
              <strong className="text-parchment-100">Colors:</strong> You must play as <strong className="text-parchment-100">{myColor}</strong> and {opponentName} must play as <strong className="text-parchment-100">{opponentColor}</strong>.
            </li>
            <li>Play the game to the end. Only games that match these rules and finish after this challenge was accepted count.</li>
            <li>We&rsquo;ll spot the finished game and settle the wager. If we can&rsquo;t, report the result below.</li>
          </ol>
        </div>

        <div className="flex flex-wrap gap-2">
          <a href={playUrl} target="_blank" rel="noopener noreferrer" className="btn-gold">
            Start match on Chess.com
          </a>
          {profileUrl && (
            <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost">
              Open {opponentName}&rsquo;s Chess.com profile
            </a>
          )}
        </div>
        <p className="text-xs text-steel-500">
          Chess.com doesn&rsquo;t guarantee a pre-filled challenge for every opponent. If the link doesn&rsquo;t
          land on a new game against {opponentName}, send the challenge from their profile instead.
        </p>
      </section>

      <AutoStatus
        phase={phase}
        lastCheckedAt={lastCheckedAt}
        stalled={stalled}
        missingAcceptTime={sinceMs === null}
        onRetry={restart}
      />

      {manualVisible ? (
        <ResultReportPanel
          opponentName={opponentName}
          submittedChoice={submitted}
          opponentReported={opponentReported}
          mismatch={mismatch}
          canSend={isConnected}
          onSubmit={handleSubmit}
          onChange={() => setSubmitted(null)}
        />
      ) : (
        <button
          type="button"
          className="self-start text-sm text-steel-400 underline hover:text-parchment-100"
          onClick={() => setShowManual(true)}
        >
          Finished but not detected? Report the result yourself
        </button>
      )}

      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/80 p-4 backdrop-blur-sm">
          <div className="panel max-w-lg w-full p-8 text-center flex flex-col items-center gap-5 shadow-2xl">
            <div className={`font-display text-7xl drop-shadow-sm ${iAmWhite ? "text-white" : "text-steel-400"}`}>
              {iAmWhite ? "♟" : "♙"}
            </div>
            <h2 className="font-display text-2xl text-parchment-50">Match Rules & Color Assignment</h2>
            <div className="text-left space-y-4 text-sm text-steel-300">
              <p>
                <strong>1. Format:</strong> You must play a <strong className="text-parchment-100">Rated Blitz or Rapid</strong> game on Chess.com.
              </p>
              <p>
                <strong>2. Your Color:</strong> The server has randomly assigned you to play as <strong className="text-parchment-100">{myColor}</strong>. Your opponent {opponentName} must play as {opponentColor}.
              </p>
              <p>
                <strong>3. Detection:</strong> Only games that match these exact parameters and finish after the challenge was accepted will count towards settling the wager.
              </p>
            </div>
            <button 
              type="button"
              className="btn-gold mt-4 w-full"
              onClick={() => setShowRulesModal(false)}
            >
              I understand, let's play
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AutoStatus({
  phase,
  lastCheckedAt,
  stalled,
  missingAcceptTime,
  onRetry,
}: {
  phase: ReturnType<typeof useAutoResolve>["phase"];
  lastCheckedAt: number | null;
  stalled: boolean;
  missingAcceptTime: boolean;
  onRetry: () => void;
}) {
  const box = "panel flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm";

  if (phase === "found") {
    return (
      <div className={box} role="status">
        <p className="text-parchment-100">
          {stalled
            ? "Game found. Settling the wager…, or you can manually report the result below"
            : "Game found. Settling the wager…"}
        </p>
      </div>
    );
  }

  if (phase === "polling") {
    return (
      <div className={box} role="status">
        <p className="flex items-center gap-2 text-steel-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-gold-400" aria-hidden />
          Watching Chess.com for your game (results can take up to a minute to appear)
        </p>
        {lastCheckedAt && (
          <p className="text-xs text-steel-500">Last checked {new Date(lastCheckedAt).toLocaleTimeString()}</p>
        )}
      </div>
    );
  }

  if (phase === "disabled") {
    return (
      <div className={box} role="status">
        <p className="text-steel-400">
          {missingAcceptTime
            ? "Automatic detection is off because the server hasn't recorded when this challenge was accepted."
            : "Automatic detection is off because one of you doesn't have a verified Chess.com account linked."}{" "}
          Report the result below once you&rsquo;ve played.
        </p>
      </div>
    );
  }

  return (
    <div className={box} role="status">
      <p className="text-steel-400">
        {phase === "error"
          ? "Couldn't reach Chess.com's game data."
          : "No finished game turned up in the last few minutes."}{" "}
        Report the result below, or check again.
      </p>
      <button type="button" className="btn-ghost text-xs" onClick={onRetry}>
        Check again
      </button>
    </div>
  );
}
