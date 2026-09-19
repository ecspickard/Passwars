# Passwars — frontend app shell

Vite + React + TypeScript + Tailwind v4 + React Router.

## Setup

```bash
npm install
npm run dev
```

The dev server proxies `/api/*` and `/ws/*` to `http://localhost:8000`
(see `vite.config.ts`), so run the FastAPI backend locally on port 8000
and everything just works with same-origin paths in the frontend code.

## Structure

- `src/lib/api.ts` — fetch wrapper, attaches the JWT, 401 -> forced logout
- `src/lib/auth-storage.ts` — localStorage helpers shared by api.ts and AuthContext
- `src/lib/types.ts` — shared API response types
- `src/context/AuthContext.tsx` — session state, login/signup/logout, persistence
- `src/context/ToastContext.tsx` + `src/components/ToastStack.tsx` — reusable toasts
- `src/hooks/useWebSocket.ts` — singleton `/ws/{user_id}` connection, pub/sub
  `subscribe(eventType, handler)`, `useWebSocketEvent` convenience hook,
  auto-reconnect with backoff
- `src/components/` — NavBar, UserMenu, NotificationBell (placeholder),
  ProtectedRoute, AppShell, ToastStack, PageHeading
- `src/pages/` — Login, Signup, Dashboard, Vault, Bank, Challenges,
  ChallengeDetail, Leaderboard, Profile, Settings, NotFound

## Design tokens

Defined in `src/index.css` under `@theme`: ink/parchment/gold/signal/felt/steel
palette, Spectral (display) + Space Grotesk (UI) type pairing, `panel`,
`btn-gold`, `btn-ghost`, `input-field` component classes.

## Notes for the next prompts

- `NotificationBell` is a static placeholder; wire it to WS challenge events
  via `useWebSocketEvent` when that prompt comes up.
- Page stubs (Vault, Bank, Challenges, ChallengeDetail, Leaderboard, Profile)
  already know their backing endpoint and just need data-fetching + UI.
- `useAuth().user.chess_username`, `UserPassword.secret_value`,
  `PasswordBank.secret_value`, `Challenge.accepted_at`, and
  `Challenge.source` are typed as "extended" fields in `src/lib/types.ts`
  ahead of the backend adding them.
