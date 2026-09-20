import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications, type AppNotification } from "../context/NotificationContext";
import { useWebSocket } from "../hooks/useWebSocket";

export function NotificationBell() {
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const handleToggle = () => {
    setOpen((v) => {
      if (!v) markAllRead();
      return !v;
    });
  };

  const { send } = useWebSocket();

  const handleSelect = (n: AppNotification) => {
    markRead(n.id);
    setOpen(false);
    navigate(`/challenges/${n.challengeId}`);
  };

  const handleAction = (e: React.MouseEvent, n: AppNotification, action: "accept_challenge" | "deny_challenge") => {
    e.stopPropagation();
    send({ type: action, challenge_id: n.challengeId });
    markRead(n.id);
    if (action === "accept_challenge") {
      setOpen(false);
      navigate(`/challenges/${n.challengeId}`);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={handleToggle}
        className="relative rounded-panel p-2 text-parchment-100 transition-colors hover:bg-ink-800 hover:text-gold-400"
        aria-label="Notifications"
        aria-expanded={open}
        title="Notifications"
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-signal-500 px-1 text-[10px] font-semibold text-parchment-50"
            aria-hidden
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

        <div className={`panel fixed right-4 top-16 z-50 w-80 max-w-[90vw] p-2 md:absolute md:right-0 md:top-auto md:mt-2 md:z-40 origin-top-right transition-all duration-300 ease-out ${
          open ? "scale-100 opacity-100 visible" : "scale-95 opacity-0 invisible"
        }`}>
          {notifications.length === 0 ? (
            <p className="p-3 text-center text-sm text-steel-400">No notifications yet.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(n)}
                    className={`w-full rounded-panel p-3 text-left text-sm transition-colors hover:bg-ink-800 flex flex-col gap-2 ${
                      n.read ? "text-steel-400" : "text-parchment-50"
                    }`}
                  >
                    <span>{n.message}</span>
                    {n.type === "challenge_received" && !n.read && (
                      <div className="flex gap-2 mt-1">
                        <button 
                          className="btn-ghost py-1 px-2 text-xs" 
                          onClick={(e) => handleAction(e, n, "deny_challenge")}
                        >
                          Decline
                        </button>
                        <button 
                          className="btn-gold py-1 px-2 text-xs" 
                          onClick={(e) => handleAction(e, n, "accept_challenge")}
                        >
                          Accept
                        </button>
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
    </div>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
