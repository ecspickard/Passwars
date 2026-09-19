import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate("/login");
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-panel border border-ink-700 px-3 py-1.5 text-sm text-parchment-100 transition-colors hover:border-gold-500"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-500 font-display text-xs font-semibold text-ink-950">
          {user.username.slice(0, 1).toUpperCase()}
        </span>
        {user.username}
      </button>

      {open && (
        <div
          role="menu"
          className="panel absolute right-0 z-40 mt-2 w-44 overflow-hidden py-1 shadow-lg shadow-black/40"
        >
          <Link
            to={`/profile/${user.id}`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-parchment-100 hover:bg-ink-800 hover:text-gold-400"
          >
            Profile
          </Link>
          <Link
            to="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-parchment-100 hover:bg-ink-800 hover:text-gold-400"
          >
            Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="block w-full px-3 py-2 text-left text-sm text-signal-500 hover:bg-ink-800"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
