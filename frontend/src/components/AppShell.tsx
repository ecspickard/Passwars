import type { ReactNode } from "react";
import { IncomingChallengeBanner } from "./IncomingChallengeBanner";
import { NavBar } from "./NavBar";
import { ToastStack } from "./ToastStack";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <NavBar />
      <IncomingChallengeBanner />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      <ToastStack />
    </div>
  );
}
