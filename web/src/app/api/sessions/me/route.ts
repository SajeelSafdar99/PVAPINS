import { prisma } from "@/lib/db";
import { ensureSuperAdmin, userFromRequest } from "@/lib/auth";
import { json, options } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export function OPTIONS(request: Request) {
  return options(request);
}

export async function GET(request: Request) {
  await ensureSuperAdmin();
  const limited = rateLimit(`session-me:${clientIp(request)}`, 30, 60 * 1000);
  if (!limited.ok) {
    return json(request, { error: "Too many requests. Try again shortly." }, 429);
  }

  const user = await userFromRequest(request);
  if (!user) return json(request, { error: "Unauthorized." }, 401);
  if (user.role !== "USER") {
    return json(request, { error: "Only user accounts can fetch an assigned session." }, 403);
  }

  const session = await prisma.session.findUnique({ where: { userId: user.id } });
  if (!session) return json(request, { error: "No session assigned yet." }, 404);

  return json(request, { payload: session.payload, updatedAt: session.updatedAt });
}
