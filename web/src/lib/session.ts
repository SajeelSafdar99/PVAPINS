import type { Prisma } from "@prisma/client";
import { allowDemoSessions } from "@/lib/demo";

const MAX_BYTES = 1_000_000;
const MAX_COOKIES = 150;
const SAME_SITE = new Set(["no_restriction", "lax", "strict", "unspecified"]);

function hostOf(domain: unknown) {
  return String(domain || "").replace(/^\./, "").toLowerCase();
}

function isGrammarlyDomain(domain: unknown) {
  const host = hostOf(domain);
  return host === "grammarly.com" || host.endsWith(".grammarly.com");
}

function isPvapinsDomain(domain: unknown) {
  const host = hostOf(domain);
  return host === "pvapins.com" || host.endsWith(".pvapins.com");
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizeCookies(input: Record<string, unknown>[], match: (domain: unknown) => boolean) {
  return input
    .filter((cookie) => cookie && typeof cookie.name === "string" && typeof cookie.value === "string")
    .filter((cookie) => match(cookie.domain))
    .map((cookie) => {
      const sameSite =
        typeof cookie.sameSite === "string" && SAME_SITE.has(cookie.sameSite)
          ? cookie.sameSite
          : "unspecified";
      const parsed: Record<string, string | boolean | number> = {
        name: String(cookie.name).slice(0, 128),
        value: String(cookie.value).slice(0, 4096),
        domain: String(cookie.domain),
        path: typeof cookie.path === "string" ? cookie.path : "/",
        secure: Boolean(cookie.secure),
        httpOnly: Boolean(cookie.httpOnly),
        sameSite,
        session: Boolean(cookie.session),
        hostOnly: Boolean(cookie.hostOnly),
      };
      if (typeof cookie.expirationDate === "number") {
        parsed.expirationDate = cookie.expirationDate;
      }
      return parsed;
    });
}

function looksLikePvapins(
  raw: { source?: unknown },
  pvapins: Record<string, string | boolean | number>[],
  grammarly: Record<string, string | boolean | number>[]
) {
  if (raw.source === "pvapins-web") return true;
  if (pvapins.length === 0) return false;
  return !grammarly.some((cookie) => cookie.name === "grauth");
}

export function parseSessionPayload(raw: unknown) {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { cookies?: unknown }).cookies)) {
    throw new Error("Invalid session file: missing cookies array.");
  }

  const encoded = JSON.stringify(raw);
  if (encoded.length > MAX_BYTES) {
    throw new Error("Session file is too large.");
  }

  const input = raw as { cookies: Record<string, unknown>[]; storage?: unknown; source?: unknown };
  if (input.cookies.length === 0 || input.cookies.length > MAX_COOKIES) {
    throw new Error("Session file has an invalid number of cookies.");
  }

  const grammarly = normalizeCookies(input.cookies, isGrammarlyDomain);
  const pvapins = normalizeCookies(input.cookies, isPvapinsDomain);

  if (looksLikePvapins(input, pvapins, grammarly)) {
    if (!allowDemoSessions()) {
      throw new Error("Session JSON is missing grauth. Export again while logged into Grammarly.");
    }
    if (pvapins.length === 0) {
      throw new Error("Session JSON has no PVAPins cookies. Export again while logged into app.pvapins.com.");
    }
    if (!pvapins.some((cookie) => cookie.name === "u_access_token")) {
      throw new Error("Session JSON is missing u_access_token. Export again while logged into app.pvapins.com.");
    }

    const payload = asJson({
      version: 1,
      source: "pvapins-web",
      cookies: pvapins,
      storage: input.storage && typeof input.storage === "object" ? input.storage : {},
      summary: {
        count: pvapins.length,
        hasGrauth: false,
        hasCsrf: false,
      },
    });

    return {
      payload,
      cookieCount: pvapins.length,
      hasGrauth: false,
    };
  }

  const hasGrauth = grammarly.some((cookie) => cookie.name === "grauth");
  if (!hasGrauth) {
    throw new Error("Session JSON is missing grauth. Export again while logged into Grammarly.");
  }

  const payload = asJson({
    version: 1,
    source: "grammarly-web",
    cookies: grammarly,
    storage: input.storage && typeof input.storage === "object" ? input.storage : {},
    summary: {
      count: grammarly.length,
      hasGrauth: true,
      hasCsrf: grammarly.some((cookie) => cookie.name === "csrf-token"),
    },
  });

  return {
    payload,
    cookieCount: grammarly.length,
    hasGrauth: true,
  };
}

const AUTH_COOKIE_NAMES = new Set([
  "grauth",
  "csrf-token",
  "gac",
  "tdi",
  "u_access_token",
  "u_refresh_token",
]);

function payloadCookies(payload: unknown): { name?: unknown; value?: unknown; expirationDate?: unknown }[] {
  if (!payload || typeof payload !== "object") return [];
  const cookies = (payload as { cookies?: unknown }).cookies;
  return Array.isArray(cookies) ? cookies : [];
}

export function sessionExpiresAt(payload: unknown): string | null {
  const cookies = payloadCookies(payload);
  const auth =
    cookies.find((cookie) => cookie.name === "grauth") ||
    cookies.find((cookie) => cookie.name === "u_access_token");
  if (typeof auth?.expirationDate !== "number") return null;
  const ms = auth.expirationDate * 1000;
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

export function sessionFingerprint(payload: unknown): string {
  return payloadCookies(payload)
    .filter((cookie) => AUTH_COOKIE_NAMES.has(String(cookie.name)))
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .sort()
    .join("\n");
}
