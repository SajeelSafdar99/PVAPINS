import { cookies } from "next/headers";
import { COOKIE_NAME, verifyToken } from "@/lib/jwt";
import { AppShell } from "@/components/AppShell";
import { SwaggerPanel } from "./swagger";

export default async function DocsPage() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;
  const isAdmin = user?.role === "SUPER_ADMIN";

  return (
    <AppShell
      role={isAdmin ? "admin" : user ? "user" : "guest"}
      email={user?.email}
      current="/docs"
      backHref={isAdmin ? "/admin" : user ? "/dashboard" : "/login"}
      wide
      title="API contract"
      subtitle="Every field the website and extensions use. Implement this on a new backend, then set NEXT_PUBLIC_API_BASE_URL."
    >
      <SwaggerPanel />
    </AppShell>
  );
}
