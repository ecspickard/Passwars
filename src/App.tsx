import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Bank from "./pages/Bank";
import ChallengeDetail from "./pages/ChallengeDetail";
import Challenges from "./pages/Challenges";
import Dashboard from "./pages/Dashboard";
import Leaderboard from "./pages/Leaderboard";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Signup from "./pages/Signup";
import Vault from "./pages/Vault";

// Wraps a page in the authenticated shell (nav + toasts) and the auth guard.
function Protected({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/vault" element={<Protected><Vault /></Protected>} />
      <Route path="/bank" element={<Protected><Bank /></Protected>} />
      <Route path="/challenges" element={<Protected><Challenges /></Protected>} />
      <Route path="/challenges/:id" element={<Protected><ChallengeDetail /></Protected>} />
      <Route path="/leaderboard" element={<Protected><Leaderboard /></Protected>} />
      <Route path="/profile/:id" element={<Protected><Profile /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
