import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../hooks/useWebSocket";
import { ChessLinkBadge } from "./ChessLinkBadge";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";

const LINKS = [
  { to: "/vault", label: "Vault" },
  { to: "/challenges", label: "Challenge Arena" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/bank", label: "Bank" },
];

export function NavBar() {
  const { user } = useAuth();
  const { isConnected } = useWebSocket();

  return (
    <header className="sticky top-0 z-30 border-b border-ink-700 bg-ink-950/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <NavLink to="/dashboard" className="flex items-center gap-2">
            <LogoMark />
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

function LogoMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="6" fill="#1c1a14" stroke="#3a3527" />
      <path
        d="M16 6c-1.4 0-2.5 1.1-2.5 2.5 0 .8.4 1.5 1 2-1.6.6-2.5 2.1-2.5 4h8c0-1.9-.9-3.4-2.5-4 .6-.5 1-1.2 1-2C18.5 7.1 17.4 6 16 6z"
        fill="#d9b65c"
      />
      <path d="M11 15h10l1 4H10l1-4z" fill="#d9b65c" />
      <rect x="9" y="20" width="14" height="3" rx="1" fill="#d9b65c" />
      <rect x="13" y="24" width="6" height="2.5" rx="0.5" fill="#f4eddc" opacity="0.35" />
    </svg>
  );
}
