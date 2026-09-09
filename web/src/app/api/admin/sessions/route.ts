import { prisma } from "@/lib/db";
import { ensureSuperAdmin, userFromRequest } from "@/lib/auth";
import { json, options } from "@/lib/http";
import { parseSessionPayload } from "@/lib/session";

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
    return json(request, { error: error instanceof Error ? error.message : "Invalid session." }, 400);
  }

  const users = await prisma.user.findMany({
    where: { role: "USER" },
    select: { id: true },
  });
  if (users.length === 0) {
    return json(request, { error: "There are no users to assign this file to." }, 400);
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

  return json(request, {
    ok: true,
    assigned: users.length,
    cookieCount: session.cookieCount,
    hasGrauth: session.hasGrauth,
  });
}
