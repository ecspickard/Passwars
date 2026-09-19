import { PageHeading } from "../components/PageHeading";

export default function Leaderboard() {
  return (
    <div>
      <PageHeading
        title="Leaderboard"
        description="Ranked by passwords collected"
      />
      <div className="panel p-8 text-center text-steel-400">Standings will appear here.</div>
    </div>
  );
}
