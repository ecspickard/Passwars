import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BankEntryCard } from "../components/BankEntryCard";
import { PageHeading } from "../components/PageHeading";
import { ApiError } from "../lib/api";
import { listBankEntries, lookupUsernames, type BankEntry } from "../lib/bank";

type SortKey = "newest" | "oldest" | "name";

export default function Bank() {
  const [entries, setEntries] = useState<BankEntry[] | null>(null);
  const [owners, setOwners] = useState<Record<number, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");

  const loadEntries = async () => {
    setLoadError(null);
    try {
      const data = await listBankEntries();
      setEntries(data);
      // Names are a nicety: show the list right away, fill names in after.
      const ids = data.flatMap((e) => (e.collected_from !== null ? [e.collected_from] : []));
      if (ids.length > 0) setOwners(await lookupUsernames(ids));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Couldn't load your bank.");
    }
  };

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => {
    if (!entries) return [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? entries.filter((e) => e.service_name.toLowerCase().includes(q))
      : [...entries];

    const time = (e: BankEntry) => new Date(e.collected_at).getTime();
    if (sort === "newest") filtered.sort((a, b) => time(b) - time(a));
    else if (sort === "oldest") filtered.sort((a, b) => time(a) - time(b));
    else filtered.sort((a, b) => a.service_name.localeCompare(b.service_name));
    return filtered;
  }, [entries, query, sort]);

  return (
    <div>
      <PageHeading
        title="Password bank"
        description="Services you've won off other players. Copy a password when you need it; it's never shown on screen."
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          placeholder="Search services…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input-field max-w-xs"
          aria-label="Search your bank by service name"
        />
        <label className="flex items-center gap-2 text-sm text-steel-400">
          Sort by
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="input-field w-auto"
          >
            <option value="newest">Most recent</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Service name</option>
          </select>
        </label>
      </div>

      {loadError && (
        <div className="panel mb-4 border-signal-500 p-4 text-sm text-signal-500">
          {loadError}{" "}
          <button type="button" className="underline" onClick={loadEntries}>
            Try again
          </button>
        </div>
      )}

      {entries === null && !loadError ? (
        <div className="panel p-8 text-center text-steel-400">Opening your bank…</div>
      ) : entries && entries.length === 0 ? (
        <div className="panel flex flex-col items-center gap-3 p-8 text-center text-steel-400">
          <span className="font-display text-2xl text-gold-400" aria-hidden>
            ♛
          </span>
          <p>Win your first challenge to start collecting.</p>
          <Link to="/challenges" className="btn-gold">
            Go to the Challenge Arena
          </Link>
        </div>
      ) : entries && visible.length === 0 ? (
        <div className="panel p-8 text-center text-steel-400">
          No services match &ldquo;{query}&rdquo;.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((entry) => (
            <BankEntryCard
              key={entry.id}
              entry={entry}
              ownerName={entry.collected_from !== null ? owners[entry.collected_from] : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
