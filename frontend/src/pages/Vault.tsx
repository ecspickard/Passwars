import { PageHeading } from "../components/PageHeading";

export default function Vault() {
  return (
    <div>
      <PageHeading
        title="Your vault"
        description="The services you've staked, wired up to POST /api/users/passwords in a later prompt."
      />
      <div className="panel p-8 text-center text-steel-400">
        Vault entries will appear here.
      </div>
    </div>
  );
}
