import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <span className="font-display text-4xl text-gold-400">♟</span>
      <h1 className="font-display text-2xl text-parchment-50">This square is empty</h1>
      <p className="max-w-sm text-steel-400">
        There's nothing at this address. Head back to your dashboard.
      </p>
      <Link to="/dashboard" className="btn-ghost mt-2">
        Back to dashboard
      </Link>
    </div>
  );
}
