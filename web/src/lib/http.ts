import { NextResponse } from "next/server";

function allowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return "";

  const site = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (site && origin === site) return origin;
  if (origin.startsWith("chrome-extension://")) return origin;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return null;
}

export function corsHeaders(request: Request) {
  const origin = allowedOrigin(request);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    Vary: "Origin",
    "X-Content-Type-Options": "nosniff",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}

export function json(request: Request, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders(request) });
}

export function options(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}
