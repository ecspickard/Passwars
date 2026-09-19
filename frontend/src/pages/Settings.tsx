import { useAuth } from "../context/AuthContext";
import { PageHeading } from "../components/PageHeading";

export default function Settings() {
  const { user } = useAuth();

  return (
    <div>
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
          <div>
            <dt className="text-steel-400">Chess.com username</dt>
            <dd className="mt-0.5 text-parchment-50">
              {user?.chess_username ?? "Not linked yet"}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
