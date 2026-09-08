export function parseSessionPayload(raw: unknown) {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { cookies?: unknown }).cookies)) {
    throw new Error("Invalid session file: missing cookies array.");
  }

  const payload = raw as { cookies: { name?: string }[] };
  if (JSON.stringify(payload).length > 2_000_000) {
    throw new Error("Session file is too large.");
  }

  return {
    payload,
    cookieCount: payload.cookies.length,
    hasGrauth: payload.cookies.some((cookie) => cookie.name === "grauth"),
  };
}
