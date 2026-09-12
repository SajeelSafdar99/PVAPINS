import { NextResponse } from "next/server";
import { COOKIE_NAME, cookieOptions, userFromRequest } from "@/lib/auth";
import { corsHeaders, options } from "@/lib/http";
import { requestIp, writeLog } from "@/lib/log";

export function OPTIONS(request: Request) {
  return options(request);
}

export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (user) {
    await writeLog({
      level: "info",
      source: "api",
      action: "auth.logout",
      message: "Signed out.",
      email: user.email,
      ip: requestIp(request),
    });
  }
  const response = NextResponse.json({ ok: true }, { headers: corsHeaders(request) });
  response.cookies.set(COOKIE_NAME, "", { ...cookieOptions(), maxAge: 0 });
  return response;
}
