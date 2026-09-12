import { prisma } from "@/lib/db";
import { ensureSuperAdmin, userFromRequest } from "@/lib/auth";
import { json, options } from "@/lib/http";
import { parseSessionPayload, sessionExpiresAt, sessionFingerprint } from "@/lib/session";
import { requestIp, writeLog } from "@/lib/log";

export function OPTIONS(request: Request) {
  return options(request);
}

export async function POST(request: Request) {
  await ensureSuperAdmin();
  const admin = await userFromRequest(request);
  if (!admin || admin.role !== "SUPER_ADMIN") {
    return json(request, { error: "Admin only." }, 403);
  }

  let session;
  try {
    session = parseSessionPayload(await request.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid session.";
    await writeLog({
      level: "error",
      source: "api",
      action: "session.assign",
      message,
      email: admin.email,
      ip: requestIp(request),
    });
    return json(request, { error: message }, 400);
  }

  const users = await prisma.user.findMany({
    where: { role: "USER" },
    select: { id: true, session: { select: { payload: true, updatedAt: true } } },
  });
  if (users.length === 0) {
    await writeLog({
      level: "warn",
      source: "api",
      action: "session.assign",
      message: "No users to assign.",
      email: admin.email,
      ip: requestIp(request),
    });
    return json(request, { error: "There are no users to assign this file to." }, 400);
  }

  const expiresAt = sessionExpiresAt(session.payload);
  const fingerprint = sessionFingerprint(session.payload);
  const alreadyAssigned = users.filter((user) => user.session);
  const sameCookies =
    alreadyAssigned.length === users.length &&
    alreadyAssigned.every((user) => sessionFingerprint(user.session?.payload) === fingerprint);

  if (sameCookies) {
    return json(request, {
      ok: true,
      unchanged: true,
      assigned: users.length,
      cookieCount: session.cookieCount,
      hasGrauth: session.hasGrauth,
      expiresAt,
      updatedAt: alreadyAssigned[0]?.session?.updatedAt ?? null,
    });
  }

  await prisma.$transaction(
    users.map((user) =>
      prisma.session.upsert({
        where: { userId: user.id },
        create: { userId: user.id, payload: session.payload },
        update: { payload: session.payload },
      })
    )
  );

  await writeLog({
    level: "info",
    source: "api",
    action: "session.assign",
    message: `Assigned ${session.cookieCount} cookies to ${users.length} users. Expires ${expiresAt || "unknown"}.`,
    email: admin.email,
    ip: requestIp(request),
  });

  return json(request, {
    ok: true,
    unchanged: false,
    assigned: users.length,
    cookieCount: session.cookieCount,
    hasGrauth: session.hasGrauth,
    expiresAt,
  });
}
