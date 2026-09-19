// Polls Chess.com for a finished game between the two players of an accepted
// challenge. Stops when a usable result is found, when the polling window
// runs out, or after repeated failures — at which point the UI falls back to
// manual self-reporting.

import { useEffect, useRef, useState } from "react";
import { DRAW_POLICY, findMatchResult, type FoundResult } from "../lib/chessMatch";

export const POLL_INTERVAL_MS = 15_000;
/** How long one polling run lasts before we give up and offer manual reporting. */
export const POLL_WINDOW_MS = 10 * 60_000;
const MAX_CONSECUTIVE_FAILURES = 3;

export type AutoPhase =
  | "disabled" // can't run: missing Chess.com handle or acceptance time
  | "polling"
  | "found"
  | "timed_out"
  | "error";

interface Options {
  challengerChess?: string | null;
  defenderChess?: string | null;
  /** Epoch ms of Challenge.accepted_at; games ending before this are ignored. */
  sinceMs: number | null;
  onResult: (result: FoundResult) => void;
}

export function useAutoResolve({ challengerChess, defenderChess, sinceMs, onResult }: Options) {
  const [state, setState] = useState<Exclude<AutoPhase, "disabled">>("polling");
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [runId, setRunId] = useState(0);

  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const canRun = Boolean(challengerChess && defenderChess && sinceMs !== null);

  useEffect(() => {
    if (!canRun || !challengerChess || !defenderChess || sinceMs === null) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const startedAt = Date.now();
    const controller = new AbortController();

    setState("polling");

    const tick = async () => {
      try {
        const result = await findMatchResult(challengerChess, defenderChess, sinceMs, controller.signal);
        if (cancelled) return;
        failures = 0;
        setLastCheckedAt(Date.now());

        const usable =
          result.kind === "decisive" || (result.kind === "draw" && DRAW_POLICY === "void");
        if (usable && result.kind !== "none") {
          setState("found");
          onResultRef.current(result);
          return;
        }
      } catch {
        if (cancelled) return;
        failures += 1;
        if (failures >= MAX_CONSECUTIVE_FAILURES) {
          setState("error");
          return;
        }
      }

      if (Date.now() - startedAt >= POLL_WINDOW_MS) {
        setState("timed_out");
        return;
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    tick();

    return () => {
      cancelled = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [canRun, challengerChess, defenderChess, sinceMs, runId]);

  const phase: AutoPhase = canRun ? state : "disabled";
  const restart = () => setRunId((n) => n + 1);

  return { phase, lastCheckedAt, restart };
}
