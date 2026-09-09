import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, verifyToken } from "@/lib/jwt";
import { AppShell } from "@/components/AppShell";
import { UserGuide } from "@/components/guides";

export default async function UserGuidePage() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) redirect("/login");
  if (user.role === "SUPER_ADMIN") redirect("/admin/guide");

  return (
    <AppShell
      role="user"
      email={user.email}
      current="/dashboard/guide"
      title="User guide"
      subtitle="How to install Apply and fetch the session the admin assigned to you."
    >
      <UserGuide />
    </AppShell>
  );
}
