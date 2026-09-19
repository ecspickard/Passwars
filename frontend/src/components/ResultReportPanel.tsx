import { useState } from "react";

export type ReportChoice = "me" | "them" | "draw";

interface Props {
  opponentName: string;
  /** What this player has already reported, if anything. */
  submittedChoice: ReportChoice | null;
  /** The opponent has reported; this player still needs to. */
  opponentReported: boolean;
  /** The last pair of reports disagreed. */
  mismatch: boolean;
  canSend: boolean;
  onSubmit: (choice: ReportChoice) => void;
  /** Withdraw the current report so it can be changed. */
  onChange: () => void;
}

export function ResultReportPanel({
  opponentName,
  submittedChoice,
  opponentReported,
  mismatch,
  canSend,
  onSubmit,
  onChange,
}: Props) {
  const [choice, setChoice] = useState<ReportChoice | "">("");

  const label = (c: ReportChoice) =>
    c === "me" ? "You won" : c === "them" ? `${opponentName} won` : "The game was a draw";

  if (submittedChoice) {
    return (
      <div className="panel flex flex-col gap-3 p-5" role="status">
        <h3 className="font-display text-lg text-parchment-50">
          Waiting on {opponentName} to confirm
        </h3>
        <p className="text-sm text-steel-400">
          You reported: <span className="text-parchment-100">{label(submittedChoice)}</span>. The
          result becomes final once both players report the same outcome.
        </p>
        <button type="button" className="btn-ghost self-start text-sm" onClick={onChange}>
          Change my report
        </button>
      </div>
    );
  }

  return (
    <form
      className="panel flex flex-col gap-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (choice) onSubmit(choice);
      }}
    >
      <div>
        <h3 className="font-display text-lg text-parchment-50">Report the result</h3>
        <p className="mt-1 text-sm text-steel-400">
          Each player reports on their own. Nothing changes hands until your reports match.
        </p>
      </div>

      {mismatch && (
        <p
          role="alert"
          className="rounded-panel border border-signal-500 bg-signal-500/10 px-3 py-2 text-sm text-parchment-50"
        >
          Your reports didn&rsquo;t match, so nothing was resolved. Check the game on Chess.com
          together, then each report again.
        </p>
      )}

      {opponentReported && !mismatch && (
        <p
          role="status"
          className="rounded-panel border border-gold-500/40 bg-gold-500/5 px-3 py-2 text-sm text-parchment-100"
        >
          {opponentName} has already reported. Add your report to finish.
        </p>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Who won?</legend>
        {(["me", "them", "draw"] as const).map((c) => (
          <label
            key={c}
            className={`flex cursor-pointer items-center gap-3 rounded-panel border px-3 py-2 text-sm transition-colors ${
              choice === c
                ? "border-gold-500 text-gold-400"
                : "border-ink-700 text-parchment-100 hover:border-gold-500/60"
            }`}
          >
            <input
              type="radio"
              name="result"
              value={c}
              checked={choice === c}
              onChange={() => setChoice(c)}
              className="accent-[var(--color-gold-500)]"
            />
            {label(c)}
          </label>
        ))}
      </fieldset>

      {!canSend && (
        <p className="text-xs text-steel-400">Reconnecting to the live server. You can submit once it&rsquo;s back.</p>
      )}

      <button type="submit" className="btn-gold self-start" disabled={!choice || !canSend}>
        Submit report
      </button>
    </form>
  );
}
