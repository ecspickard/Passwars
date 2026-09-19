// Manages the single /ws/{user_id} connection for the whole app.
//
// Design: the raw WebSocket lives in a module-level singleton, not in React
// state, so that no matter how many components call useWebSocket(), there's
// ever only one live socket. Components subscribe to specific event types
// ("challenge_received", "game_move", ...) via `subscribe`, which is a tiny
// pub/sub keyed by the incoming message's `type` field — one feature's
// listener never sees another feature's events unless it asks for them (or
// subscribes to "*" for everything).
//
// The connection opens once `useAuth()` has a logged-in user, and
// reconnects automatically (with capped exponential backoff) if it drops.

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";

export interface WsEvent<T = unknown> {
  type: string;
  [key: string]: unknown;
  payload?: T;
}

type Listener = (event: WsEvent) => void;

const MAX_BACKOFF_MS = 15_000;
const BASE_BACKOFF_MS = 1_000;

class SocketManager {
  private socket: WebSocket | null = null;
  private userId: number | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private connectionListeners = new Set<(connected: boolean) => void>();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private consumerCount = 0;
  private intentionallyClosed = false;

  get isConnected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  /** Called by each mounted useWebSocket() instance. */
  addConsumer(userId: number) {
    this.consumerCount += 1;
    this.connect(userId);
  }

  /** Called on unmount of each useWebSocket() instance. */
  removeConsumer() {
    this.consumerCount = Math.max(0, this.consumerCount - 1);
    if (this.consumerCount === 0) this.disconnect();
  }

  connect(userId: number) {
    this.intentionallyClosed = false;

    if (this.socket && this.userId === userId) {
      // Already connected (or connecting) for this user — nothing to do.
      if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
        return;
      }
    }

    if (this.socket && this.userId !== userId) {
      this.hardCloseCurrentSocket();
    }

    this.userId = userId;
    this.openSocket();
  }

  private openSocket() {
    if (this.userId === null) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws/${this.userId}`;
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.connectionListeners.forEach((cb) => cb(true));
    };

    socket.onmessage = (event) => {
      let parsed: WsEvent;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        console.warn("[ws] received non-JSON message", event.data);
        return;
      }
      // Deliverable checklist: verify connectivity with a console log.
      console.log("[ws] message received:", parsed);

      this.listeners.get(parsed.type)?.forEach((cb) => cb(parsed));
      this.listeners.get("*")?.forEach((cb) => cb(parsed));
    };

    socket.onclose = () => {
      this.connectionListeners.forEach((cb) => cb(false));
      if (!this.intentionallyClosed && this.consumerCount > 0) {
        this.scheduleReconnect();
      }
    };

    socket.onerror = () => {
      // onclose will fire right after and handle reconnection.
      console.warn("[ws] socket error");
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(
      BASE_BACKOFF_MS * 2 ** this.reconnectAttempt,
      MAX_BACKOFF_MS,
    );
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.userId !== null && this.consumerCount > 0) {
        this.openSocket();
      }
    }, delay);
  }

  private hardCloseCurrentSocket() {
    if (!this.socket) return;
    this.socket.onclose = null;
    this.socket.onerror = null;
    this.socket.onmessage = null;
    this.socket.close();
    this.socket = null;
  }

  disconnect() {
    this.intentionallyClosed = true;
    this.userId = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.hardCloseCurrentSocket();
    this.connectionListeners.forEach((cb) => cb(false));
  }

  send(event: WsEvent) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(event));
    } else {
      console.warn("[ws] tried to send while disconnected, dropping event:", event);
    }
  }

  subscribe(eventType: string, listener: Listener) {
    if (!this.listeners.has(eventType)) this.listeners.set(eventType, new Set());
    this.listeners.get(eventType)!.add(listener);
    return () => {
      this.listeners.get(eventType)?.delete(listener);
    };
  }

  onConnectionChange(listener: (connected: boolean) => void) {
    this.connectionListeners.add(listener);
    return () => {
      this.connectionListeners.delete(listener);
    };
  }
}

// One socket manager for the whole app lifetime.
const socketManager = new SocketManager();

export function useWebSocket() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(socketManager.isConnected);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (userId === null) return;
    socketManager.addConsumer(userId);
    return () => socketManager.removeConsumer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => socketManager.onConnectionChange(setIsConnected), []);

  const send = useCallback((event: WsEvent) => socketManager.send(event), []);

  /**
   * Subscribe to one event type (e.g. "challenge_received"), or "*" for
   * every event. Returns an unsubscribe function — call it from your own
   * effect's cleanup.
   */
  const subscribe = useCallback(
    (eventType: string, listener: Listener) => socketManager.subscribe(eventType, listener),
    [],
  );

  return { send, subscribe, isConnected };
}

/**
 * Subscribe to a single event type for the lifetime of the calling
 * component, without needing to manage the effect/cleanup yourself.
 */
export function useWebSocketEvent(eventType: string, listener: Listener) {
  const { subscribe } = useWebSocket();
  const listenerRef = useRef(listener);

  useEffect(() => {
    listenerRef.current = listener;
  }, [listener]);

  useEffect(() => {
    return subscribe(eventType, (event) => listenerRef.current(event));
  }, [eventType, subscribe]);
}
