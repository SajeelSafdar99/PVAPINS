"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      className="rounded-lg border border-[#2a3344] px-3 py-2 text-sm text-[#93a0b5] hover:bg-[#181e29] hover:text-[#e8eef8]"
    >
      Sign out
    </button>
  );
}
