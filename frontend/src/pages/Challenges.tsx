import { PageHeading } from "../components/PageHeading";
import { RequireChessLink } from "../components/RequireChessLink";

export default function Challenges() {
  return (
    <div>
      <PageHeading
        title="Challenge Arena"
        description="Send and respond to challenges here, live over the /ws connection."
      />
      <RequireChessLink>
        <div className="panel p-8 text-center text-steel-400">
          No challenges yet — this is where incoming and outgoing challenges will live.
        </div>
      </RequireChessLink>
    </div>
  );
}
