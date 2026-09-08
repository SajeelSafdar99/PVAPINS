import { prisma } from "@/lib/db";
import {
  ensureSuperAdmin,
  hashPassword,
  normalizeEmail,
  userFromRequest,
  validPassword,
} from "@/lib/auth";
import { json, options } from "@/lib/http";
import { parseSessionPayload } from "@/lib/session";

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

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { session: { select: { updatedAt: true } } },
  });

  return json(
    request,
    users.map((user) => ({
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      hasSession: Boolean(user.session),
      sessionUpdatedAt: user.session?.updatedAt ?? null,
    }))
  );
}

export async function POST(request: Request) {
  if (!(await requireAdmin(request))) {
    return json(request, { error: "Admin only." }, 403);
  }

  const body = await request.json();
  const email = normalizeEmail(body.email);
  const password = body.password;

  if (!email || !email.includes("@")) {
    return json(request, { error: "A valid email is required." }, 400);
  }
  if (!validPassword(password)) {
    return json(request, { error: "Password must be at least 8 characters." }, 400);
  }

  if (!body.session) {
    return json(request, { error: "Assign a session JSON when adding a user." }, 400);
  }

  let session;
  try {
    session = parseSessionPayload(body.session);
  } catch (error) {
    return json(request, { error: error instanceof Error ? error.message : "Invalid session." }, 400);
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return json(request, { error: "That email is already in use." }, 409);
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      role: "USER",
      session: { create: { payload: session.payload } },
    },
  });

  return json(
    request,
    {
      id: user.id,
      email: user.email,
      role: user.role,
      cookieCount: session.cookieCount,
      hasGrauth: session.hasGrauth,
    },
    201
  );
}
