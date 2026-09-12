import { prisma } from "@/lib/db";
import { ensureSuperAdmin, userFromRequest } from "@/lib/auth";
import { json, options } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { sessionExpiresAt } from "@/lib/session";
import { requestIp, writeLog } from "@/lib/log";

export function OPTIONS(request: Request) {
  return options(request);
}

export async function GET(request: Request) {
  await ensureSuperAdmin();
  const limited = rateLimit(`session-me:${clientIp(request)}`, 30, 60 * 1000);
  if (!limited.ok) {
    await writeLog({
      level: "warn",
      source: "api",
      action: "session.fetch",
      message: "Rate limited.",
      ip: requestIp(request),
    });
    return json(request, { error: "Too many requests. Try again shortly." }, 429);
  }

  const user = await userFromRequest(request);
  if (!user) return json(request, { error: "Unauthorized." }, 401);
  if (user.role !== "USER") {
    return json(request, { error: "Only user accounts can fetch an assigned session." }, 403);
  }

  const session = await prisma.session.findUnique({ where: { userId: user.id } });
  if (!session) {
    await writeLog({
      level: "warn",
      source: "api",
      action: "session.fetch",
      message: "No session assigned.",
      email: user.email,
      ip: requestIp(request),
    });
    return json(request, { error: "No session assigned yet." }, 404);
  }

  await writeLog({
    level: "info",
    source: "api",
    action: "session.fetch",
    message: "User fetched assigned session.",
    email: user.email,
    ip: requestIp(request),
  });

  return json(request, {
    payload: session.payload,
    updatedAt: session.updatedAt,
    expiresAt: sessionExpiresAt(session.payload),
  });
}
