import { Link } from "react-router-dom";
import { revealBankSecret, type BankEntry } from "../lib/bank";
import { CopySecretButton } from "./CopySecretButton";

export function BankEntryCard({
  entry,
  ownerName,
}: {
  entry: BankEntry;
  /** Resolved username of the previous owner, if known. */
  ownerName?: string;
}) {
  const collectedDate = entry.collected_at
    ? new Date(entry.collected_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="panel flex flex-col gap-3 p-4">
      <div>
        <p className="break-words font-display text-base text-parchment-50">{entry.service_name}</p>
        <p className="text-xs text-steel-400">
          Won from{" "}
          {entry.collected_from !== null ? (
            <Link to={`/profile/${entry.collected_from}`} className="text-gold-400 hover:underline">
              {ownerName ?? `Player #${entry.collected_from}`}
            </Link>
          ) : (
            "a player who has since left"
          )}
          {collectedDate && <> on {collectedDate}</>}
        </p>
      </div>

      <p className="select-none font-mono text-lg tracking-widest text-steel-400" aria-hidden>
        ••••••••••••
      </p>

      <div>
        <CopySecretButton
          serviceName={entry.service_name}
          fetchSecret={async () => (await revealBankSecret(entry.id)).secret_value}
        />
      </div>
    </div>
  );
}
