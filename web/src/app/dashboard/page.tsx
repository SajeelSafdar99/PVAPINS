import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, verifyToken } from "@/lib/jwt";
import { UserDashboard } from "./ui";

export default async function DashboardPage() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) redirect("/login");
  if (user.role === "SUPER_ADMIN") redirect("/admin");
  return <UserDashboard email={user.email} />;
}
