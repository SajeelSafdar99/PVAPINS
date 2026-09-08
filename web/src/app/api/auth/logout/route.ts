import { NextResponse } from "next/server";
import { COOKIE_NAME, cookieOptions } from "@/lib/auth";
import { corsHeaders, options } from "@/lib/http";

export function OPTIONS(request: Request) {
  return options(request);
}

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true }, { headers: corsHeaders(request) });
  response.cookies.set(COOKIE_NAME, "", { ...cookieOptions(), maxAge: 0 });
  return response;
}
