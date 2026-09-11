"use client";

import { useRouter } from "next/navigation";
import { api, rememberToken } from "@/lib/api";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    rememberToken();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted transition hover:border-line-strong hover:text-text"
    >
      Sign out
    </button>
  );
}
