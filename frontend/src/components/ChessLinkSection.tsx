import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";
import {
  lookupChessComPlayer,
  startChessLink,
  verifyChessLink,
  unlinkChessAccount,
  type ChessComPublicProfile,
} from "../lib/chess";

type Step =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "not_found" }
  | { kind: "network_error" }
  | { kind: "confirm"; profile: ChessComPublicProfile }
  | { kind: "starting" }
  | { kind: "pending" }
  | { kind: "verifying" }
  | { kind: "verify_failed" };

export function ChessLinkSection() {
  const { user, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [handleInput, setHandleInput] = useState("");
  const [step, setStep] = useState<Step>({ kind: "idle" });
  // Code/instructions live outside the Step union so they survive the
  // pending -> verifying -> verify_failed transitions without re-fetching.
  const [pendingInfo, setPendingInfo] = useState<{ code: string; instructions: string } | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);

  const verified = Boolean(user?.chess_username && user?.chess_verified_at);

  const reset = () => {
    setStep({ kind: "idle" });
    setHandleInput("");
    setPendingInfo(null);
    setActionError(null);
    setIsEditing(false);
  };

  const handleCheck = async () => {
    const handle = handleInput.trim();
    if (!handle) return;
    setActionError(null);
    setStep({ kind: "checking" });
    const result = await lookupChessComPlayer(handle);
    if (result.status === "found") {
      setStep({ kind: "confirm", profile: result.profile });
    } else {
      setStep(result);
    }
  };

  const handleConfirm = async (profile: ChessComPublicProfile) => {
    setStep({ kind: "starting" });
    setActionError(null);
    try {
      const res = await startChessLink(profile.username);
      setPendingInfo({ code: res.verification_code, instructions: res.instructions });
      setStep({ kind: "pending" });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't start linking. Try again.");
      setStep({ kind: "confirm", profile });
    }
  };

  const handleVerify = async () => {
    setStep({ kind: "verifying" });
    setActionError(null);
    try {
      const res = await verifyChessLink();
      if (res.verified) {
        await refreshUser();
        reset();
      } else {
        setStep({ kind: "verify_failed" });
      }
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't verify right now. Try again.");
      setStep({ kind: "verify_failed" });
    }
  };

  const handleUnlink = async () => {
    setIsUnlinking(true);
    setActionError(null);
    try {
      await unlinkChessAccount();
      await refreshUser();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't unlink right now. Try again.");
    } finally {
      setIsUnlinking(false);
    }
  };

  return (
    <div className="panel max-w-md p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg text-parchment-50">Chess.com account</h2>
          <p className="mt-0.5 text-sm text-steel-400">
            {verified
              ? `Verified as ${user?.chess_username}. Challenges you're in can be auto-resolved from your games.`
              : user?.chess_username
                ? `Linking to ${user.chess_username} started but isn't verified yet.`
                : "Required to send or receive challenges."}
          </p>
        </div>
        {verified && !isEditing && (
          <button
            type="button"
            className="btn-ghost shrink-0 text-xs"
            onClick={handleUnlink}
            disabled={isUnlinking}
          >
            {isUnlinking ? "Unlinking…" : "Unlink"}
          </button>
        )}
      </div>

      {actionError && (
        <p
          role="alert"
          className="mt-3 rounded-panel border border-signal-500 bg-signal-500/10 px-3 py-2 text-sm"
        >
          {actionError}
        </p>
      )}

      {!isEditing && step.kind === "idle" && (
        <button type="button" className="btn-gold mt-4" onClick={() => setIsEditing(true)}>
          {verified ? "Change linked account" : "Link your Chess.com account"}
        </button>
      )}

      {isEditing && (
        <div className="mt-4 flex flex-col gap-3">
          {step.kind === "idle" || step.kind === "not_found" || step.kind === "network_error" ? (
            <>
              <div className="flex gap-2">
                <input
                  className="input-field"
                  placeholder="Chess.com username"
                  value={handleInput}
                  onChange={(e) => setHandleInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCheck()}
                  autoFocus
                />
                <button type="button" className="btn-gold shrink-0" onClick={handleCheck}>
                  Check
                </button>
              </div>
              {step.kind === "not_found" && (
                <p className="text-xs text-signal-500">
                  No Chess.com account found with that username. Double-check the spelling.
                </p>
              )}
              {step.kind === "network_error" && (
                <p className="text-xs text-signal-500">
                  Couldn't reach Chess.com right now. Check your connection and try again.
                </p>
              )}
              <button
                type="button"
                className="self-start text-xs text-steel-400 hover:text-parchment-100"
                onClick={reset}
              >
                Cancel
              </button>
            </>
          ) : step.kind === "checking" ? (
            <p className="text-sm text-steel-400">Checking Chess.com…</p>
          ) : step.kind === "confirm" ? (
            <div className="flex items-center gap-3 rounded-panel border border-ink-700 p-3">
              {step.profile.avatar && (
                <img src={step.profile.avatar} alt="" className="h-12 w-12 rounded-full" />
              )}
              <div className="flex-1">
                <p className="font-medium text-parchment-50">
                  {step.profile.name || step.profile.username}
                </p>
                <p className="text-xs text-steel-400">@{step.profile.username}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-gold text-xs"
                  onClick={() => handleConfirm(step.profile)}
                >
                  This is me
                </button>
                <button type="button" className="btn-ghost text-xs" onClick={reset}>
                  Not this one
                </button>
              </div>
            </div>
          ) : step.kind === "starting" ? (
            <p className="text-sm text-steel-400">Starting verification…</p>
          ) : step.kind === "pending" || step.kind === "verifying" || step.kind === "verify_failed" ? (
            <div className="flex flex-col gap-3 rounded-panel border border-gold-500/40 bg-gold-500/5 p-3">
              <p className="text-sm text-parchment-100">
                {step.kind === "verify_failed"
                  ? "That code isn't on your profile yet, or Chess.com hasn't picked it up. Add it and try again."
                  : pendingInfo?.instructions}
              </p>
              {pendingInfo && (
                <code className="w-fit rounded bg-ink-950 px-2 py-1 font-mono text-sm text-gold-400">
                  {pendingInfo.code}
                </code>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-gold text-xs"
                  onClick={handleVerify}
                  disabled={step.kind === "verifying"}
                >
                  {step.kind === "verifying" ? "Verifying…" : "I've added it — verify"}
                </button>
                <button type="button" className="btn-ghost text-xs" onClick={reset}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
