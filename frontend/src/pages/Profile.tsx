import { useParams } from "react-router-dom";
import { PageHeading } from "../components/PageHeading";

export default function Profile() {
  const { id } = useParams<{ id: string }>();

  return (
    <div>
      <PageHeading
        title="Player profile"
        description={`Backed by GET /api/users/profile/${id} — offerings, join date, and total passwords won.`}
      />
      <div className="panel p-8 text-center text-steel-400">Profile details will appear here.</div>
    </div>
  );
}
