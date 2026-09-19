import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../hooks/useWebSocket";
import { BrandMark } from "./BrandMark";
import { ChessLinkBadge } from "./ChessLinkBadge";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";

const LINKS = [
  { to: "/vault", label: "Vault" },
  { to: "/challenges", label: "Challenge Arena" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/bank", label: "Bank" },
  { to: "/settings", label: "Settings" },
];

export function NavBar() {
  const { user } = useAuth();
  const { isConnected } = useWebSocket();

  return (
    <header className="sticky top-0 z-30 border-b border-ink-700 bg-ink-950/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <NavLink to="/dashboard" className="flex items-center gap-2">
            <BrandMark size={28} />
            <span className="font-display text-lg font-semibold tracking-tight text-parchment-50">
              Passwars
            </span>
          </NavLink>

          {user && (
            <nav className="hidden items-center gap-1 sm:flex">
              {LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `rounded-panel px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-ink-800 text-gold-400"
                        : "text-parchment-100 hover:bg-ink-800 hover:text-gold-400"
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
          )}
        </div>

        {user && (
          <div className="flex items-center gap-3">
            <ChessLinkBadge />
            <span
              className={`hidden h-2 w-2 rounded-full sm:inline-block ${
                isConnected ? "bg-felt-500" : "bg-signal-500"
              }`}
              title={isConnected ? "Live connection active" : "Reconnecting…"}
              aria-hidden
            />
            <NotificationBell />
            <UserMenu />
          </div>
        )}
      </div>
    </header>
  );
}

