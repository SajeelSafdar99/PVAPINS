import { SignJWT, jwtVerify } from "jose";

export const COOKIE_NAME = "pvapins_token";
export const TOKEN_HEADER = "X-Pvapins-Token";
export const TOKEN_TTL_DAYS = 14;
export const TOKEN_REFRESH_AFTER_MS = 60 * 60 * 1000;

export type TokenUser = {
  id: string;
  email: string;
  role: "SUPER_ADMIN" | "USER";
};

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(value);
}

export async function signToken(user: TokenUser) {
  return new SignJWT({ email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setExpirationTime(`${TOKEN_TTL_DAYS}d`)
    .sign(secret());
}

function userFromPayload(payload: { sub?: string; email?: unknown; role?: unknown }): TokenUser | null {
  if (!payload.sub || payload.email == null || payload.role == null) return null;
  return {
    id: payload.sub,
    email: String(payload.email),
    role: payload.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER",
  };
}

export async function verifyToken(token: string): Promise<TokenUser | null> {
  const verified = await readToken(token);
  return verified?.user ?? null;
}

export async function readToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret());
    const user = userFromPayload(payload);
    if (!user) return null;
    return { user, iat: typeof payload.iat === "number" ? payload.iat : 0 };
  } catch {
    return null;
  }
}

export function rawTokenFromRequest(request: Request) {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7);
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * TOKEN_TTL_DAYS,
  };
}

export async function attachRefreshedToken(
  request: Request,
  response: { cookies: { set: (name: string, value: string, options?: object) => void }; headers: Headers }
) {
  const raw = rawTokenFromRequest(request);
  if (!raw) return;
  const verified = await readToken(raw);
  if (!verified) return;
  if (Date.now() - verified.iat * 1000 < TOKEN_REFRESH_AFTER_MS) return;

  const token = await signToken(verified.user);
  response.cookies.set(COOKIE_NAME, token, cookieOptions());
  response.headers.set(TOKEN_HEADER, token);
}
