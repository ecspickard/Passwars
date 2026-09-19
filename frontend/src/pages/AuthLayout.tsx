import type { ReactNode } from "react";

export function AuthLayout({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="font-display text-3xl text-gold-400">♚</span>
          <h1 className="mt-3 font-display text-2xl font-semibold text-parchment-50">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-steel-400">{subtitle}</p>}
        </div>
        <div className="panel p-6">{children}</div>
        {footer && (
          <p className="mt-6 text-center text-sm text-steel-400">{footer}</p>
        )}
      </div>
    </div>
  );
}
