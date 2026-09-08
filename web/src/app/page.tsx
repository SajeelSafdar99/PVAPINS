import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, verifyToken } from "@/lib/jwt";

export default async function Home() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;
  if (!user) redirect("/login");
  redirect(user.role === "SUPER_ADMIN" ? "/admin" : "/dashboard");
}
