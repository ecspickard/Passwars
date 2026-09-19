import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { FormError, FormField } from "./FormField";
import { useToast } from "../context/ToastContext";
import { useWebSocket } from "../hooks/useWebSocket";
import { ApiError } from "../lib/api";
import type { Player } from "../lib/players";
import type { User } from "../lib/types";
import { listVaultEntries, type VaultEntry } from "../lib/vault";

interface Props {
  me: User;
  opponent: Player;
  onClose: () => void;
  /** Called after the send_challenge event has been fired. */
  onSent: (defenderId: number) => void;
}

export function ChallengeModal({ me, opponent, onClose, onSent }: Props) {
  const { showToast } = useToast();
  const { send, isConnected } = useWebSocket();

  const [vault, setVault] = useState<VaultEntry[] | null>(null);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [myService, setMyService] = useState("");
  const [theirService, setTheirService] = useState(
    opponent.services.length === 1 ? opponent.services[0] : "",
  );

  useEffect(() => {
    let cancelled = false;
    listVaultEntries()
      .then((data) => {
        if (!cancelled) setVault(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setVaultError(err instanceof ApiError ? err.message : "Couldn't load your vault.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Both players need a verified Chess.com account (the same guard as
  // RequireChessLink), since results are matched against their real games.
  const meVerified = Boolean(me.chess_username && me.chess_verified_at);
  const themVerified = Boolean(opponent.chess_username);

  let block: { message: string; settingsLink?: boolean } | null = null;
  if (!meVerified) {
    block = {
      message: "Link and verify your Chess.com account before you can send challenges.",
      settingsLink: true,
    };
  } else if (!themVerified) {
    block = {
      message: `${opponent.username} hasn't linked a verified Chess.com account, so their games can't be tracked. Pick another player.`,
    };
  } else if (!isConnected) {
    block = { message: "Reconnecting to the live server. You can send once it's back." };
  }

  const accountBlocked = !meVerified || !themVerified;
  const vaultEmpty = vault !== null && vault.length === 0;
  const canSend = !block && Boolean(myService) && Boolean(theirService);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    send({
      type: "send_challenge",
      challenger_id: me.id,
      defender_id: opponent.id,
      challenger_service: myService,
      defender_service: theirService,
      challenger_name: me.username,
    });
    showToast(`Challenge sent to ${opponent.username}.`, "success");
    onSent(opponent.id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="challenge-modal-title"
    >
      <div className="panel w-full max-w-sm p-6">
        <h2 id="challenge-modal-title" className="font-display text-lg text-parchment-50">
          Challenge {opponent.username}
        </h2>
        <p className="mt-1 text-sm text-steel-400">
          Win the match on Chess.com and you collect their service. Lose and they collect yours.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          {vaultError && <FormError message={vaultError} />}

          {block && (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-panel border border-gold-500/40 bg-gold-500/5 p-3 text-sm text-parchment-100"
            >
              <p>{block.message}</p>
              {block.settingsLink && (
                <Link to="/settings" onClick={onClose} className="btn-gold self-start text-xs">
                  Go to settings
                </Link>
              )}
            </div>
          )}

          <FormField id="challenge-my-service" label="You wager">
            <select
              id="challenge-my-service"
              className="input-field"
              value={myService}
              onChange={(e) => setMyService(e.target.value)}
              disabled={accountBlocked || vault === null || vaultEmpty}
            >
              <option value="">{vault === null ? "Loading your vault…" : "Choose one of yours…"}</option>
              {vault?.map((entry) => (
                <option key={entry.id} value={entry.service_name}>
                  {entry.service_name}
                </option>
              ))}
            </select>
            {vaultEmpty && (
              <p className="text-xs text-steel-400">
                Your vault is empty.{" "}
                <Link to="/vault" onClick={onClose} className="text-gold-400 hover:underline">
                  Add a service
                </Link>{" "}
                to wager it.
              </p>
            )}
          </FormField>

          <FormField id="challenge-their-service" label="You're after">
            <select
              id="challenge-their-service"
              className="input-field"
              value={theirService}
              onChange={(e) => setTheirService(e.target.value)}
              disabled={accountBlocked}
            >
              <option value="">Choose one of theirs…</option>
              {opponent.services.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
          </FormField>

          <div className="mt-2 flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-gold" disabled={!canSend} title={block?.message}>
              Send challenge
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
