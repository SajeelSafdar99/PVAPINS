import { prisma } from "@/lib/db";
import {
  ensureSuperAdmin,
  hashPassword,
  normalizeEmail,
  userFromRequest,
  validPassword,
} from "@/lib/auth";
import { json, options } from "@/lib/http";

async function requireAdmin(request: Request) {
  await ensureSuperAdmin();
  const user = await userFromRequest(request);
  if (!user || user.role !== "SUPER_ADMIN") return null;
  return user;
}

export function OPTIONS(request: Request) {
  return options(request);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request);
  if (!admin) return json(request, { error: "Admin only." }, 403);

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role !== "USER") {
    return json(request, { error: "User not found." }, 404);
  }

  const body = await request.json();
  const email = body.email != null ? normalizeEmail(body.email) : user.email;
  if (!email || !email.includes("@")) {
    return json(request, { error: "A valid email is required." }, 400);
  }

  if (email !== user.email) {
    const taken = await prisma.user.findUnique({ where: { email } });
    if (taken) return json(request, { error: "That email is already in use." }, 409);
  }

  const data: { email: string; passwordHash?: string } = { email };
  if (body.password) {
    if (!validPassword(body.password)) {
      return json(request, { error: "Password must be at least 8 characters." }, 400);
    }
    data.passwordHash = await hashPassword(body.password);
  }

  const updated = await prisma.user.update({ where: { id }, data });
  return json(request, { id: updated.id, email: updated.email, role: updated.role });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request);
  if (!admin) return json(request, { error: "Admin only." }, 403);

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
