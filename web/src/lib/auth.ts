import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { COOKIE_NAME, cookieOptions, signToken, verifyToken, type TokenUser } from "./jwt";

export { COOKIE_NAME, cookieOptions, signToken, verifyToken };
export type { TokenUser };

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function userFromRequest(request: Request): Promise<TokenUser | null> {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    return verifyToken(header.slice(7));
  }
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  return token ? verifyToken(token) : null;
}

export async function ensureSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "SUPER_ADMIN") {
      return prisma.user.update({
        where: { id: existing.id },
        data: { role: "SUPER_ADMIN" },
      });
    }
    return existing;
  }

  const currentAdmin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  if (currentAdmin) {
    return prisma.user.update({
      where: { id: currentAdmin.id },
      data: { email },
    });
  }

  return prisma.user.create({
    data: { email, passwordHash: await hashPassword(password), role: "SUPER_ADMIN" },
  });
}

export function normalizeEmail(email: unknown) {
  if (typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

export function validPassword(password: unknown) {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}
