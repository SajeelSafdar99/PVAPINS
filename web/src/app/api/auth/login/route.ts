import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  COOKIE_NAME,
  cookieOptions,
  ensureSuperAdmin,
  normalizeEmail,
  signToken,
  verifyPassword,
} from "@/lib/auth";
import { corsHeaders, json, options } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export function OPTIONS(request: Request) {
  return options(request);
}

export async function POST(request: Request) {
  try {
    await ensureSuperAdmin();
    const body = await request.json();
    const email = normalizeEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";

    const limited = rateLimit(`login:${clientIp(request)}:${email}`, 8, 15 * 60 * 1000);
    if (!limited.ok) {
      return json(request, { error: "Too many login attempts. Try again in a few minutes." }, 429);
    }

    if (!email || !password) {
      return json(request, { error: "Email and password are required." }, 400);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return json(request, { error: "Invalid email or password." }, 401);
    }

    const tokenUser = { id: user.id, email: user.email, role: user.role };
    const token = await signToken(tokenUser);
    const response = NextResponse.json(
      { token, user: tokenUser },
      { headers: corsHeaders(request) }
    );
    response.cookies.set(COOKIE_NAME, token, cookieOptions());
    return response;
  } catch (error) {
    return json(request, { error: "Login failed." }, 500);
  }
}
