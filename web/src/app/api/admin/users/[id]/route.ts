import { prisma } from "@/lib/db";
import { ensureSuperAdmin, userFromRequest } from "@/lib/auth";
import { json, options } from "@/lib/http";

export function OPTIONS(request: Request) {
  return options(request);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureSuperAdmin();
  const admin = await userFromRequest(request);
  if (!admin || admin.role !== "SUPER_ADMIN") {
    return json(request, { error: "Admin only." }, 403);
  }

  const { id } = await params;
  if (id === admin.id) {
    return json(request, { error: "You cannot delete your own admin account." }, 400);
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return json(request, { error: "User not found." }, 404);
  if (user.role === "SUPER_ADMIN") {
    return json(request, { error: "Cannot delete a super admin." }, 400);
  }

  await prisma.user.delete({ where: { id } });
  return json(request, { ok: true });
}
