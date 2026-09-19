import { useParams } from "react-router-dom";
import { PageHeading } from "../components/PageHeading";

export default function ChallengeDetail() {
  const { id } = useParams<{ id: string }>();

  return (
    <div>
      <PageHeading
        title={`Challenge #${id}`}
        description="The live board and move-by-move play will render here."
      />
      <div className="panel flex aspect-square max-w-md items-center justify-center text-steel-400">
        Board coming soon
      </div>
    </div>
  );
}
