import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/** Wrap any challenge-sending/accepting UI in this. */
export function RequireChessLink({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const verified = Boolean(user?.chess_username && user?.chess_verified_at);

  if (verified) return <>{children}</>;

  return (
    <div className="panel flex flex-col items-center gap-3 p-8 text-center text-steel-400">
      <span className="font-display text-2xl text-gold-400">♟</span>
      <p>Link and verify a Chess.com account before you can send or receive challenges.</p>
      <Link to="/settings" className="btn-gold">
        Go to settings
      </Link>
    </div>
  );
}
