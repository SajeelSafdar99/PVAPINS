import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, verifyToken } from "@/lib/jwt";
import { AppShell } from "@/components/AppShell";
import { AdminGuide } from "@/components/guides";

export default async function AdminGuidePage() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "SUPER_ADMIN") redirect("/login");

  return (
    <AppShell
      role="admin"
      email={user.email}
      current="/admin/guide"
      title="Admin guide"
      subtitle="How to install Capture, export a Grammarly JSON, and assign it to a user."
      backHref="/admin"
    >
      <AdminGuide />
    </AppShell>
  );
}
