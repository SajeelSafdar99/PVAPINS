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

export function AppShell({
  role,
  email,
  current,
  title,
  subtitle,
  children,
}: {
  role: Role;
  email: string;
  current: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#0b1018]">
      <header className="sticky top-0 z-50 border-b border-[#2a3344] bg-[#121826]/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-[#3dd6c6]">PVAPINS</p>
            <p className="text-sm text-[#93a0b5]">{email}</p>
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
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="mb-8">
          <p className="text-sm text-[#3dd6c6]">{role === "admin" ? "Super admin" : "User"}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-2 max-w-2xl text-[#93a0b5]">{subtitle}</p> : null}
        </div>
        {children}
      </main>
    </div>
  );
}
