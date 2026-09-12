import { prisma } from "@/lib/db";
import { ensureSuperAdmin, userFromRequest } from "@/lib/auth";
import { json, options } from "@/lib/http";
import { writeLog } from "@/lib/log";

export function OPTIONS(request: Request) {
  return options(request);
}

async function requireAdmin(request: Request) {
  await ensureSuperAdmin();
  const user = await userFromRequest(request);
  if (!user || user.role !== "SUPER_ADMIN") return null;
  return user;
}

export async function GET(request: Request) {
  if (!(await requireAdmin(request))) {
    return json(request, { error: "Admin only." }, 403);
  }

  const url = new URL(request.url);
  const level = url.searchParams.get("level") || "";
  const source = url.searchParams.get("source") || "";
  const q = url.searchParams.get("q")?.trim() || "";

  const logs = await prisma.eventLog.findMany({
    where: {
      ...(level ? { level } : {}),
      ...(source ? { source } : {}),
      ...(q
        ? {
            OR: [
              { action: { contains: q, mode: "insensitive" } },
              { message: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return json(request, { logs });
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return json(request, { error: "Admin only." }, 403);

  const result = await prisma.eventLog.deleteMany();
  await writeLog({
    level: "warn",
    source: "api",
    action: "logs.clear",
    message: `Cleared ${result.count} log rows.`,
    email: admin.email,
  });
  return json(request, { ok: true, deleted: result.count });
}
