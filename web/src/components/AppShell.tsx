"use client";

import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";

type Role = "admin" | "user";

const NAV: Record<Role, { href: string; label: string }[]> = {
  admin: [
    { href: "/admin", label: "Users" },
    { href: "/admin/guide", label: "Admin guide" },
  ],
  user: [
    { href: "/dashboard", label: "Extension" },
    { href: "/dashboard/guide", label: "User guide" },
  ],
};

function BrandMark() {
  return (
    <span
      aria-hidden
      className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-strong text-sm font-bold text-accent-ink shadow-[0_8px_24px_-10px_rgba(61,214,198,0.8)]"
    >
      PV
    </span>
  );
}

export function AppShell({
  role,
  email,
  current,
  title,
  subtitle,
  showNav = true,
  tabBar,
  children,
}: {
  role: Role;
  email: string;
  current?: string;
  title: string;
  subtitle?: string;
  /** Route links in the header. Turn off when the page drives its own tabs. */
  showNav?: boolean;
  /** Optional secondary bar (e.g. in-page tabs) shown under the header. */
  tabBar?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-3.5">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-[0.18em] text-text">PVAPINS</p>
              <p className="text-xs text-muted">{email}</p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-1.5">
            {showNav
              ? NAV[role].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={current === item.href ? "page" : undefined}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                      current === item.href
                        ? "bg-accent/15 text-accent"
                        : "text-muted hover:bg-surface hover:text-text"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))
              : null}
            <LogoutButton />
          </nav>
        </div>
        {tabBar ? (
          <div className="mx-auto max-w-5xl px-4">
            <div className="flex gap-1 overflow-x-auto">{tabBar}</div>
          </div>
        ) : null}
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            {role === "admin" ? "Super admin" : "User"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text">{title}</h1>
          {subtitle ? <p className="mt-2 max-w-2xl leading-relaxed text-muted">{subtitle}</p> : null}
        </div>
        {children}
      </main>
    </div>
  );
}
