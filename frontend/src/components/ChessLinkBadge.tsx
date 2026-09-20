import { useAuth } from "../context/AuthContext";

export function ChessLinkBadge() {
  const { user } = useAuth();
  const verified = Boolean(user?.chess_username && user?.chess_verified_at);

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 lg:gap-1.5 rounded-panel border px-1.5 lg:px-2.5 py-1 text-xs font-medium ${
        verified ? "border-felt-500 text-felt-500" : "border-signal-500 text-signal-500"
      }`}
      title={
        verified
          ? `Verified as ${user?.chess_username} on Chess.com`
          : "Link and verify a Chess.com account to send or receive challenges"
      }
    >
      <span aria-hidden>{verified ? "♞" : "♟"}</span>
      <span className="hidden md:inline">{verified ? user?.chess_username : "Not linked"}</span>
    </span>
  );
}
