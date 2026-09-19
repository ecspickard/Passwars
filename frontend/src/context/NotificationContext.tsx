import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useWebSocketEvent } from "../hooks/useWebSocket";
import { useAuth } from "./AuthContext";
import { listMyChallenges } from "../lib/challenges";

export type NotificationEventType =
  | "challenge_received"
  | "challenge_accepted"
  | "challenge_denied"
  | "challenge_expired"
  | "game_ended";

export interface AppNotification {
  id: string;
  type: NotificationEventType;
  challengeId: number;
  message: string;
  createdAt: number;
  read: boolean;
}

export interface IncomingChallenge {
  challengeId: number;
  challengerName: string;
  challengerService: string;
  defenderService: string;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  markAllRead: () => void;
  markRead: (id: string) => void;
  incomingChallenge: IncomingChallenge | null;
  dismissIncomingChallenge: () => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);
const MAX_NOTIFICATIONS = 50;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [incomingChallenge, setIncomingChallenge] = useState<IncomingChallenge | null>(null);

  const pushNotification = useCallback(
    (n: Omit<AppNotification, "id" | "createdAt" | "read">) => {
      setNotifications((prev) =>
        [{ ...n, id: crypto.randomUUID(), createdAt: Date.now(), read: false }, ...prev].slice(
          0,
          MAX_NOTIFICATIONS,
        ),
      );
    },
    [],
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listMyChallenges().then((challenges) => {
      if (cancelled) return;
      
      const pendings = challenges.filter((c) => c.status === "pending" && c.defender_id === user.id);
      if (pendings.length === 0) return;

      // The backend returns them ordered by created_at desc.
      // We process them in reverse so the newest ends up at the top of the notification list.
      [...pendings].reverse().forEach((c) => {
        pushNotification({
          type: "challenge_received",
          challengeId: c.id,
          message: `${c.challenger_name} challenged you: their ${c.challenger_service} for your ${c.defender_service}.`,
        });
      });

      // Show the banner for the most recent unhandled challenge.
      const latest = pendings[0];
      setIncomingChallenge({
        challengeId: latest.id,
        challengerName: latest.challenger_name,
        challengerService: latest.challenger_service,
        defenderService: latest.defender_service,
      });
    }).catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, [user, pushNotification]);

  useWebSocketEvent("challenge_received", (event) => {
    const challengeId = Number(event.challenge_id);
    const challengerName = String(event.challenger_name ?? "Someone");
    const challengerService = String(event.challenger_service ?? "");
    const defenderService = String(event.defender_service ?? "");

    pushNotification({
      type: "challenge_received",
      challengeId,
      message: `${challengerName} challenged you: their ${challengerService} for your ${defenderService}.`,
    });

    // Drives the unmissable banner. If a second challenge arrives before
    // this one is handled, it simply replaces it — one at a time is enough.
    setIncomingChallenge({ challengeId, challengerName, challengerService, defenderService });
  });

  useWebSocketEvent("challenge_accepted", (event) => {
    const opponent = event.opponent_chess_username ? String(event.opponent_chess_username) : null;
    pushNotification({
      type: "challenge_accepted",
      challengeId: Number(event.challenge_id),
      message: opponent
        ? `Challenge accepted — play ${opponent} on Chess.com.`
        : "Your challenge was accepted.",
    });
  });

  useWebSocketEvent("challenge_denied", (event) => {
    pushNotification({
      type: "challenge_denied",
      challengeId: Number(event.challenge_id),
      message: "Your challenge was declined.",
    });
  });

  useWebSocketEvent("challenge_expired", (event) => {
    pushNotification({
      type: "challenge_expired",
      challengeId: Number(event.challenge_id),
      message: "A pending challenge expired after going unanswered for an hour.",
    });
  });

  useWebSocketEvent("game_ended", (event) => {
    const won = user ? Number(event.winner_id) === user.id : false;
    pushNotification({
      type: "game_ended",
      challengeId: Number(event.challenge_id),
      message: won
        ? "You won! The service has been added to your bank."
        : "Game over — you lost this one.",
    });
  });

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const dismissIncomingChallenge = useCallback(() => setIncomingChallenge(null), []);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      markAllRead,
      markRead,
      incomingChallenge,
      dismissIncomingChallenge,
    }),
    [notifications, unreadCount, markAllRead, markRead, incomingChallenge, dismissIncomingChallenge],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationProvider");
  return ctx;
}
