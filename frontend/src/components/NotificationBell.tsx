// Placeholder for now — Prompt 7 wires this up to real-time challenge
// events over the WebSocket (unread count, dropdown of recent activity).

export function NotificationBell() {
  return (
    <button
      type="button"
      className="relative rounded-panel p-2 text-parchment-100 transition-colors hover:bg-ink-800 hover:text-gold-400"
      aria-label="Notifications"
      title="Notifications (coming soon)"
    >
      <BellIcon className="h-5 w-5" />
    </button>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
