import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeading } from "../components/PageHeading";
import { useAuth } from "../context/AuthContext";
import { getRankForUser, type RankInfo } from "../lib/leaderboard";
import { getUserProfile, type UserProfile } from "../lib/profile";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const { user: viewer } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Rank is fetched separately from the rest of the profile: it comes from
  // a different endpoint (the leaderboard has no per-user lookup), and a
  // slow/failed rank fetch shouldn't block or break the rest of the page.
  const [rank, setRank] = useState<RankInfo | null>(null);
  const [rankLoading, setRankLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    getUserProfile(id)
      .then((data) => {
        if (!cancelled) {
          setProfile(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load profile.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const numericId = Number(id);
    if (!id || !Number.isFinite(numericId)) return;
    let cancelled = false;
    setRankLoading(true);
    getRankForUser(numericId)
      .then((result) => {
        if (!cancelled) setRank(result);
      })
      .catch(() => {
        // Rank is a nicety on top of the profile - fail silently and just
        // omit the panel rather than showing an error for it.
      })
      .finally(() => {
        if (!cancelled) setRankLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div>
        <PageHeading
          title="Player profile"
          description="View player's chess stats, wagered services, and battle history"
        />
        <div className="panel p-8 text-center text-steel-400">Loading profile...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div>
        <PageHeading
          title="Player profile"
          description="View player's chess stats, wagered services, and battle history"
        />
        <div className="panel p-8 text-center text-red-400">{error || "Profile not found."}</div>
      </div>
    );
  }

  const isOwnProfile = viewer?.id === profile.id;
  const canChallenge = !isOwnProfile && Boolean(viewer) && profile.offerings.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title="Player profile"
        description="View player's chess stats, wagered services, and battle history"
      />

      <section className="panel flex flex-col items-center gap-4 p-8 text-center sm:flex-row sm:text-left">
        {profile.chess_avatar ? (
          <img
            src={profile.chess_avatar}
            alt={profile.username}
            className="h-24 w-24 rounded-full border-2 border-gold-500/40 object-cover"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-ink-600 bg-ink-800 text-3xl text-steel-500">
            {profile.username[0].toUpperCase()}
          </div>
        )}
        <div className="flex-1">
          <h2 className="font-display text-3xl text-parchment-50">{profile.username}</h2>
          <p className="mt-1 text-sm text-steel-400">
            Joined {new Date(profile.created_at).toLocaleDateString()}
          </p>
          {profile.chess_username && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-gold-500/40 px-3 py-1 text-sm font-medium text-gold-400">
              <span aria-hidden className="-translate-y-[1px]">
                ♞
              </span>
              {profile.chess_username}
            </p>
          )}
        </div>
        {canChallenge && (
          <Link
            to={`/challenges?opponent=${profile.id}`}
            className="btn-gold shrink-0 self-center sm:self-start"
          >
            Challenge {profile.username}
          </Link>
        )}
      </section>

      {/* Leaderboard standing */}
      {!rankLoading && rank && (
        <section className="panel flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <span className="font-display text-3xl text-gold-400" aria-hidden>
              {MEDAL[rank.rank] ?? `#${rank.rank}`}
            </span>
            <div>
              <p className="font-display text-lg text-parchment-50">
                Rank {rank.rank} of {rank.totalPlayers}
              </p>
              <p className="text-sm text-steel-400">
                {rank.entry.password_count}{" "}
                {rank.entry.password_count === 1 ? "password" : "passwords"} collected
              </p>
            </div>
          </div>
          <Link to="/leaderboard" className="btn-ghost text-sm">
            View full leaderboard
          </Link>
        </section>
      )}
      {!rankLoading && !rank && (
        <section className="panel flex items-center justify-between gap-4 p-5 text-sm text-steel-400">
          <p>Not on the leaderboard yet.</p>
          <Link to="/leaderboard" className="btn-ghost text-sm">
            View leaderboard
          </Link>
        </section>
      )}

      {profile.chess_stats && Object.keys(profile.chess_stats).length > 0 && (
        <section>
          <h3 className="mb-3 font-display text-lg text-parchment-100">Chess.com Ratings</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(profile.chess_stats).map(([key, rating]) => {
              const format = key.replace("chess_", "").replace("chess960_", "960 ");
              return (
                <div key={key} className="panel p-4 text-center">
                  <div className="text-xs uppercase tracking-wider text-steel-500">{format}</div>
                  <div className="mt-1 font-display text-2xl text-gold-400">{rating}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h3 className="mb-3 font-display text-lg text-parchment-100">Services Offered</h3>
          <ul className="panel divide-y divide-ink-700/50">
            {profile.offerings.length > 0 ? (
              profile.offerings.map((service, i) => (
                <li key={i} className="px-4 py-3 text-steel-300">
                  {service}
                </li>
              ))
            ) : (
              <li className="px-4 py-4 text-center text-sm text-steel-500">No services staked.</li>
            )}
          </ul>
        </section>

        <section>
          <h3 className="mb-3 font-display text-lg text-parchment-100">Vault Conquests</h3>
          <ul className="panel divide-y divide-ink-700/50">
            {profile.passwords_won.length > 0 ? (
              profile.passwords_won.map((item, i) => (
                <li key={i} className="flex items-center justify-between px-4 py-3">
                  <span className="font-medium text-parchment-200">{item.service}</span>
                  <span className="text-sm text-steel-500">from @{item.player_username}</span>
                </li>
              ))
            ) : (
              <li className="px-4 py-4 text-center text-sm text-steel-500">No passwords won yet.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
