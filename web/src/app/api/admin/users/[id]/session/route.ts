import { prisma } from "@/lib/db";
import { ensureSuperAdmin, userFromRequest } from "@/lib/auth";
import { json, options } from "@/lib/http";
import { parseSessionPayload } from "@/lib/session";

export function OPTIONS(request: Request) {
  return options(request);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSuperAdmin();
  const admin = await userFromRequest(request);
  if (!admin || admin.role !== "SUPER_ADMIN") {
    return json(request, { error: "Admin only." }, 403);
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role !== "USER") {
    return json(request, { error: "User not found." }, 404);
  }

  let session;
  try {
    session = parseSessionPayload(await request.json());
  } catch (error) {
    return json(request, { error: error instanceof Error ? error.message : "Invalid session." }, 400);
  }

  await prisma.session.upsert({
    where: { userId: id },
    create: { userId: id, payload: session.payload },
    update: { payload: session.payload },
  });

  return json(request, {
    ok: true,
    cookieCount: session.cookieCount,
    hasGrauth: session.hasGrauth,
  });
}
