import { SignJWT, jwtVerify } from "jose";

export const COOKIE_NAME = "pvapins_token";

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
    .setExpirationTime("2d")
    .sign(secret());
}

export async function verifyToken(token: string): Promise<TokenUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub || payload.email == null || payload.role == null) return null;
    return {
      id: payload.sub,
      email: String(payload.email),
      role: payload.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER",
    };
  } catch {
    return null;
  }
}
