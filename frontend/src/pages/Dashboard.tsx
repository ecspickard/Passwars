import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PageHeading } from "../components/PageHeading";
import { fetchRecentChallenges, listMyChallenges, type ChallengeRecord } from "../lib/challenges";
import { api } from "../lib/api";

export default function Dashboard() {
  const { user } = useAuth();
  const [recentBattles, setRecentBattles] = useState<ChallengeRecord[] | null>(null);

  const [servicesStaked, setServicesStaked] = useState<number | null>(null);
  const [passwordsCollected, setPasswordsCollected] = useState<number | null>(null);
  const [activeBattles, setActiveBattles] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Fetch global recent battles
    fetchRecentChallenges().then((data) => {
      if (!cancelled) setRecentBattles(data);
    }).catch(console.error);

    // Fetch user stats if logged in
    if (user?.id) {
      api.get<{ offerings: string[], passwords_collected: number }>(`/users/profile/${user.id}`)
        .then(data => {
          if (!cancelled) {
            setServicesStaked(data.offerings.length);
            setPasswordsCollected(data.passwords_collected);
          }
        }).catch(console.error);

      listMyChallenges().then(data => {
        if (!cancelled) {
          // "Open challenges" are ones that are pending or accepted
          const active = data.filter(c => c.status === "pending" || c.status === "accepted").length;
          setActiveBattles(active);
        }
      }).catch(console.error);
    }

    return () => { cancelled = true; };
  }, [user?.id]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <PageHeading
          title={`Good to see you, ${user?.username ?? "player"}`}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <StatBox label="Services staked" value={servicesStaked} />
          <StatBox label="Passwords collected" value={passwordsCollected} />
          <StatBox label="Active battles" value={activeBattles} />
        </div>
      </div>

      <section>
        <h2 className="mb-4 font-display text-2xl text-parchment-50 border-b border-ink-700 pb-2">Recent Battles</h2>
        {recentBattles === null ? (
          <div className="panel p-5 text-center text-steel-400">Loading recent battles...</div>
        ) : recentBattles.length === 0 ? (
          <div className="panel p-5 text-center text-steel-400">No battles have been fought yet.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {recentBattles.map((battle) => {
              const challengerWon = battle.winner_id === battle.challenger_id;
              const winnerName = challengerWon ? battle.challenger_name : battle.defender_name;
              const loserName = challengerWon ? battle.defender_name : battle.challenger_name;
              const wonService = challengerWon ? battle.defender_service : battle.challenger_service;

              return (
                <div key={battle.id} className="panel p-4 flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gold-500 shrink-0" aria-hidden="true">
                    <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
                    <line x1="13" x2="19" y1="19" y2="13" />
                    <line x1="16" x2="20" y1="16" y2="20" />
                    <line x1="19" x2="21" y1="21" y2="19" />
                    <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" />
                    <line x1="5" x2="9" y1="14" y2="18" />
                    <line x1="7" x2="4" y1="17" y2="20" />
                    <line x1="3" x2="5" y1="19" y2="21" />
                  </svg>
                  <p className="text-parchment-100 font-ui text-sm sm:text-base">
                    <Link to={`/profile/${battle.winner_id}`} className="font-semibold text-gold-400 hover:underline">
                      {winnerName ?? "Unknown"}
                    </Link>{" "}
                    defeated{" "}
                    <Link to={`/profile/${challengerWon ? battle.defender_id : battle.challenger_id}`} className="font-medium text-steel-300 hover:underline">
                      {loserName ?? "Unknown"}
                    </Link>{" "}
                    and claimed <span className="font-mono text-gold-500 bg-gold-500/10 px-1.5 py-0.5 rounded">{wonService}</span>
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="panel p-5">
      <p className="text-sm text-steel-400">{label}</p>
      <p className="mt-2 font-display text-3xl text-parchment-50">
        {value === null ? "—" : value}
      </p>
    </div>
  );
}
