import { Link } from "react-router-dom";
import { serviceMatches, type Player } from "../lib/players";
import { ChessRatingBadge } from "./ChessRatingBadge";

/** An existing pending/accepted challenge between you and this player. */
export type Outstanding =
  | { kind: "sent" }
  | { kind: "received" }
  | { kind: "active"; challengeId: number };

const STATUS_CHIP =
  "inline-flex items-center gap-2 rounded-panel border border-gold-500/40 bg-gold-500/5 px-2.5 py-1 text-xs text-gold-400";

export function PlayerCard({
  player,
  serviceFilter,
  outstanding,
  onChallenge,
}: {
  player: Player;
  /** Current service filter text, used to highlight the services that matched. */
  serviceFilter: string;
  outstanding?: Outstanding;
  onChallenge: () => void;
}) {
  const count = player.password_count;

  return (
    <div className="panel flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to={`/profile/${player.id}`}
            className="break-words font-display text-base text-parchment-50 hover:text-gold-400"
          >
            {player.username}
          </Link>
          <p className="text-xs text-steel-400">
            {count} {count === 1 ? "password" : "passwords"} collected
          </p>
        </div>
        <ChessRatingBadge username={player.chess_username} />
      </div>

      <ul className="flex flex-wrap gap-1.5" aria-label={`Services ${player.username} offers`}>
        {player.services.map((service) => (
          <li
            key={service}
            className={`rounded-panel border px-2 py-0.5 text-xs ${
              serviceMatches(service, serviceFilter)
                ? "border-gold-500 text-gold-400"
                : "border-ink-700 text-parchment-100"
            }`}
          >
            {service}
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-1">
        {outstanding?.kind === "sent" ? (
          <span className={STATUS_CHIP} role="status">
            <span aria-hidden>♟</span> Challenge sent, waiting for a reply
          </span>
        ) : outstanding?.kind === "received" ? (
          <span className={STATUS_CHIP} role="status">
            <span aria-hidden>♟</span> This player has challenged you
          </span>
        ) : outstanding?.kind === "active" ? (
          <Link to={`/challenges/${outstanding.challengeId}`} className="btn-ghost text-sm">
            Game in progress
          </Link>
        ) : (
          <button type="button" className="btn-gold text-sm" onClick={onChallenge}>
            Challenge
          </button>
        )}
      </div>
    </div>
  );
}
