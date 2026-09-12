import { ensureSuperAdmin, userFromRequest } from "@/lib/auth";
import { json, options } from "@/lib/http";
import { parseClientLog, requestIp, writeLog } from "@/lib/log";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export function OPTIONS(request: Request) {
  return options(request);
}

export async function POST(request: Request) {
  await ensureSuperAdmin();
  const limited = rateLimit(`client-log:${clientIp(request)}`, 20, 60 * 1000);
  if (!limited.ok) {
    return json(request, { error: "Too many log reports." }, 429);
  }

  const user = await userFromRequest(request);
  if (!user) return json(request, { error: "Unauthorized." }, 401);

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = parseClientLog(body);
  if (!parsed) return json(request, { error: "Invalid log." }, 400);

  await writeLog({
    ...parsed,
    email: user.email,
    ip: requestIp(request),
  });

  return json(request, { ok: true });
}
