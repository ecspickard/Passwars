import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

export function ChessLinkBadge() {
  const { user } = useAuth();
  const verified = Boolean(user?.chess_username && user?.chess_verified_at);
  const isMac = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('mac');

  if (verified) {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1 lg:gap-1.5 rounded-panel border px-1.5 lg:px-2.5 py-1 text-xs font-medium border-felt-500 text-felt-500"
        title={`Verified as ${user?.chess_username} on Chess.com`}
      >
        <span aria-hidden className={isMac ? '-translate-y-[1px] inline-block' : ''}>♞</span>
        <span className="hidden md:inline">{user?.chess_username}</span>
      </span>
    );
  }

  return (
    <Link
      to="/settings"
      className="inline-flex shrink-0 items-center gap-1 lg:gap-1.5 rounded-panel border px-1.5 lg:px-2.5 py-1 text-xs font-medium border-signal-500 text-signal-500 hover:bg-signal-500/10 transition-colors"
      title="Link and verify a Chess.com account to send or receive challenges"
    >
      <span aria-hidden className={isMac ? '-translate-y-[1.5px] inline-block' : ''}>♟</span>
      <span className="hidden md:inline">Not linked</span>
    </Link>
  );
}
