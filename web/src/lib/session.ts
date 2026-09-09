import type { Prisma } from "@prisma/client";

const MAX_BYTES = 1_000_000;
const MAX_COOKIES = 150;
const SAME_SITE = new Set(["no_restriction", "lax", "strict", "unspecified"]);

function isGrammarlyDomain(domain: unknown) {
  const host = String(domain || "").replace(/^\./, "").toLowerCase();
  return host === "grammarly.com" || host.endsWith(".grammarly.com");
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function parseSessionPayload(raw: unknown) {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { cookies?: unknown }).cookies)) {
    throw new Error("Invalid session file: missing cookies array.");
  }

  const encoded = JSON.stringify(raw);
  if (encoded.length > MAX_BYTES) {
    throw new Error("Session file is too large.");
  }

  const input = raw as { cookies: Record<string, unknown>[]; storage?: unknown };
  if (input.cookies.length === 0 || input.cookies.length > MAX_COOKIES) {
    throw new Error("Session file has an invalid number of cookies.");
  }

  const cookies = input.cookies
    .filter((cookie) => cookie && typeof cookie.name === "string" && typeof cookie.value === "string")
    .filter((cookie) => isGrammarlyDomain(cookie.domain))
    .map((cookie) => {
      const sameSite = typeof cookie.sameSite === "string" && SAME_SITE.has(cookie.sameSite)
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

  const hasGrauth = cookies.some((cookie) => cookie.name === "grauth");
  if (!hasGrauth) {
    throw new Error("Session JSON is missing grauth. Export again while logged into Grammarly.");
  }

  const payload = asJson({
    version: 1,
    source: "grammarly-web",
    cookies,
    storage: input.storage && typeof input.storage === "object" ? input.storage : {},
    summary: {
      count: cookies.length,
      hasGrauth: true,
      hasCsrf: cookies.some((cookie) => cookie.name === "csrf-token"),
    },
  });

  return {
    payload,
    cookieCount: cookies.length,
    hasGrauth: true,
  };
}
