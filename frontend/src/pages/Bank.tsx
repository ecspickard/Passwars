import { PageHeading } from "../components/PageHeading";

export default function Bank() {
  return (
    <div>
      <PageHeading
        title="Password bank"
        description="Services you've won off other players, backed by GET /api/users/password-bank."
      />
      <div className="panel p-8 text-center text-steel-400">
        Your winnings will appear here.
      </div>
    </div>
  );
}
