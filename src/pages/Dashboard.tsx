import { useAuth } from "../context/AuthContext";
import { PageHeading } from "../components/PageHeading";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div>
      <PageHeading
        title={`Good to see you, ${user?.username ?? "player"}.`}
        description="Your board, your challenges, and your latest wins will live here."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatPlaceholder label="Services staked" />
        <StatPlaceholder label="Passwords collected" />
        <StatPlaceholder label="Open challenges" />
      </div>
    </div>
  );
}

function StatPlaceholder({ label }: { label: string }) {
  return (
    <div className="panel p-5">
      <p className="text-sm text-steel-400">{label}</p>
      <p className="mt-2 font-display text-3xl text-parchment-50">—</p>
    </div>
  );
}
