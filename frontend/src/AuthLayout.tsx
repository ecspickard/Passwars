import type { ReactNode } from "react";
import { BrandMark } from "../components/BrandMark";

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
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandMark />
          <p className="mt-2 font-display text-lg font-semibold tracking-tight text-parchment-100">
            Passwars
          </p>
          <h1 className="mt-5 font-display text-2xl font-semibold text-parchment-50">
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
