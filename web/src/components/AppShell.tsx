"use client";

import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";

type Role = "admin" | "user" | "guest";

const NAV: Record<Role, { href: string; label: string }[]> = {
  admin: [
    { href: "/admin", label: "Users" },
    { href: "/admin/guide", label: "Admin guide" },
    { href: "/docs", label: "API" },
  ],
  user: [
    { href: "/dashboard", label: "Extension" },
    { href: "/dashboard/guide", label: "User guide" },
    { href: "/docs", label: "API" },
  ],
  guest: [
    { href: "/login", label: "Sign in" },
    { href: "/docs", label: "API" },
  ],
};

export function AppShell({
  role,
  email,
  current,
  title,
  subtitle,
  backHref,
  wide,
  children,
}: {
  role: Role;
  email?: string;
  current: string;
  title: string;
  subtitle?: string;
  backHref?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const width = wide ? "max-w-6xl" : "max-w-5xl";

  return (
    <div className="flex min-h-screen flex-col bg-[#0b1018]">
      <header className="sticky top-0 z-50 border-b border-[#2a3344] bg-[#121826]/95 backdrop-blur">
        <div className={`mx-auto flex ${width} flex-wrap items-center justify-between gap-4 px-6 py-4`}>
          <div className="flex items-center gap-4">
            {backHref ? (
              <Link
                href={backHref}
                className="inline-flex shrink-0 items-center rounded-lg border border-[#2a3344] px-3 py-2 text-sm text-[#3dd6c6] hover:bg-[#181e29]"
              >
                ← Back
              </Link>
            ) : null}
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-[#3dd6c6]">PVAPINS</p>
              <p className="text-sm text-[#93a0b5]">{email || "API contract"}</p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-2">
            {NAV[role].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm ${
                  current === item.href
                    ? "bg-[#3dd6c6] font-semibold text-[#06221f]"
                    : "text-[#93a0b5] hover:bg-[#181e29] hover:text-[#e8eef8]"
                }`}
              >
                {item.label}
              </Link>
            ))}
            {role !== "guest" ? <LogoutButton /> : null}
          </nav>
        </div>
      </header>
      <main className={`mx-auto w-full ${width} flex-1 px-6 py-10`}>
        <div className="mb-8">
          <p className="text-sm text-[#3dd6c6]">
            {role === "admin" ? "Super admin" : role === "user" ? "User" : "Docs"}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-2 max-w-2xl text-[#93a0b5]">{subtitle}</p> : null}
        </div>
        {children}
      </main>
    </div>
  );
}
