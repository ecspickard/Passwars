import { useAuth } from "../context/AuthContext";
import { PageHeading } from "../components/PageHeading";
import { ChessLinkSection } from "../components/ChessLinkSection";

export default function Settings() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Settings" description="Account details and preferences." />
      <div className="panel max-w-md p-6">
        <dl className="flex flex-col gap-4 text-sm">
          <div>
            <dt className="text-steel-400">Username</dt>
            <dd className="mt-0.5 text-parchment-50">{user?.username}</dd>
          </div>
          <div>
            <dt className="text-steel-400">Email</dt>
            <dd className="mt-0.5 text-parchment-50">{user?.email}</dd>
          </div>
        </dl>
      </div>
      <ChessLinkSection />
    </div>
  );
}
