import { prisma } from "@/lib/db";
import { hashPassword, userFromRequest, validPassword } from "@/lib/auth";
import { json, options } from "@/lib/http";
import { requestIp, writeLog } from "@/lib/log";

export function OPTIONS(request: Request) {
  return options(request);
}

export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return json(request, { error: "Unauthorized." }, 401);

  const body = await request.json();
  if (!validPassword(body.newPassword)) {
    return json(request, { error: "Password must be at least 8 characters." }, 400);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(body.newPassword) },
  });
  await writeLog({
    level: "info",
    source: "api",
    action: "auth.password",
    message: "Password changed.",
    email: user.email,
    ip: requestIp(request),
  });
  return json(request, { ok: true });
}
