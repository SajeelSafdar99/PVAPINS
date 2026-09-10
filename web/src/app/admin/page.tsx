import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, verifyToken } from "@/lib/jwt";
import { allowDemoSessions } from "@/lib/demo";
import { AdminDashboard } from "./ui";

export default async function AdminPage() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "SUPER_ADMIN") {
    redirect("/login");
  }
  return <AdminDashboard adminEmail={user.email} localDemo={allowDemoSessions()} />;
}
