import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../hooks/useWebSocket";
import { BrandMark } from "./BrandMark";
import { ChessLinkBadge } from "./ChessLinkBadge";
import { NotificationBell } from "./NotificationBell";
import { AudioPlayer } from "./AudioPlayer";
import { UserMenu } from "./UserMenu";

const LINKS = [
  { to: "/vault", label: "Vault" },
  { to: "/bank", label: "Bank" },
  { to: "/challenges", label: "Challenge Arena" },
  { to: "/leaderboard", label: "Leaderboard" },
];

export function NavBar() {
  const { user } = useAuth();
  const { isConnected } = useWebSocket();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-ink-700 bg-ink-950/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-1 px-2 md:px-4 lg:px-6">
        <div className="flex items-center gap-2 lg:gap-8">
          <NavLink to="/dashboard" className="flex items-center gap-2">
            <BrandMark size={28} />
            <span className="font-display text-lg font-semibold tracking-tight text-parchment-50">
              Passwars
            </span>
          </NavLink>

          {user && (
            <nav className="hidden items-center gap-1 md:flex">
              {LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `rounded-panel px-2 lg:px-3 py-1.5 lg:py-2 text-sm font-medium transition-colors text-left leading-tight w-min lg:w-auto ${
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
          <div className="flex items-center gap-1 md:gap-3">
            <ChessLinkBadge />
            <AudioPlayer />
            <NotificationBell />
            <UserMenu />
            <button
              type="button"
              className="md:hidden p-1 text-steel-400 hover:text-parchment-100 focus:outline-none active:scale-95 transition-transform"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle mobile menu"
            >
              <div className={`transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? "rotate-180" : "rotate-0"}`}>
                {isMobileMenuOpen ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
                )}
              </div>
            </button>
          </div>
        )}
      </div>

      {user && (
        <nav
          className={`md:hidden overflow-hidden bg-ink-950 shadow-lg transition-all duration-300 ease-in-out ${
            isMobileMenuOpen ? "max-h-96 border-t border-ink-800 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <ul className="flex flex-col gap-2 px-4 py-3">
            {LINKS.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `block rounded-panel px-3 py-3 text-base font-medium transition-colors ${
                      isActive
                        ? "bg-ink-800 text-gold-400"
                        : "text-parchment-100 hover:bg-ink-800 hover:text-gold-400"
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}

