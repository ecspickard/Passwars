// Shared "copy a secret, then auto-clear the clipboard" behavior. Used by the
// Vault cards and the Bank cards so both behave identically.
//
// The plaintext secret only ever exists inside one call to `copy()`: it is
// fetched, written to the clipboard, and dropped. It is never put in state,
// a ref, or anything else that outlives the click.

import { useEffect, useRef, useState } from "react";
import { useToast } from "../context/ToastContext";
import { ApiError } from "../lib/api";

export const CLIPBOARD_CLEAR_SECONDS = 20;

// Module-level on purpose: identifies the most recent copy across *every*
// card on the page, so an older card's pending clear can never wipe out a
// clipboard write made by a newer copy somewhere else.
let latestCopyToken = 0;

export function useCopySecret(serviceName: string, fetchSecret: () => Promise<string>) {
  const { showToast } = useToast();
  const [isCopying, setIsCopying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Only the countdown display is torn down on unmount. The clipboard-clear
  // timer is deliberately left running so navigating to another page within
  // the 20s window doesn't leave the secret sitting on the clipboard.
  useEffect(() => {
    return () => {
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    };
  }, []);

  const copy = async () => {
    setIsCopying(true);
    const myToken = ++latestCopyToken;

    try {
      const secret = await fetchSecret();
      // api.get<T> only casts the JSON, so if the server's field name ever
      // drifts from what the frontend expects, `secret` is undefined and
      // writeText(undefined) would silently copy the string "undefined".
      // Refuse to copy anything that isn't a real, non-empty string.
      if (typeof secret !== "string" || !secret) throw new Error("No password returned");
      await navigator.clipboard.writeText(secret);

      showToast(
        `Copied the password for ${serviceName} — clearing in ${CLIPBOARD_CLEAR_SECONDS}s.`,
        "info",
      );

      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);

      setSecondsLeft(CLIPBOARD_CLEAR_SECONDS);
      const tick = setInterval(() => {
        setSecondsLeft((s) => (s !== null && s > 1 ? s - 1 : 0));
      }, 1000);
      tickTimerRef.current = tick;

      clearTimerRef.current = setTimeout(async () => {
        clearInterval(tick);
        setSecondsLeft(null);
        // A newer copy has already taken over the clipboard - don't stomp it.
        if (latestCopyToken !== myToken) return;
        try {
          await navigator.clipboard.writeText("");
          showToast("Clipboard cleared.", "success");
        } catch {
          // Clipboard access can be revoked (tab lost focus, permission
          // changed) between the copy and now - nothing left to clean up.
        }
      }, CLIPBOARD_CLEAR_SECONDS * 1000);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : "Couldn't copy that password. Try again.",
        "error",
      );
    } finally {
      setIsCopying(false);
    }
  };

  return { copy, isCopying, secondsLeft };
}