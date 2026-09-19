import { useParams } from "react-router-dom";
import { PageHeading } from "../components/PageHeading";

export default function Profile() {
  const { id } = useParams<{ id: string }>();

  return (
    <div>
      <PageHeading
        title="Player profile"
        description="View player's chess stats, wagered services, and battle history"
      />
      <div className="panel p-8 text-center text-steel-400">Profile details will appear here.</div>
    </div>
  );
}
