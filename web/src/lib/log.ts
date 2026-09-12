import { prisma } from "./db";
import { clientIp } from "./rate-limit";

const LEVELS = new Set(["info", "warn", "error"]);
const SOURCES = new Set(["api", "apply", "capture", "web"]);

function clean(value: unknown, max: number) {
  return String(value || "")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/grauth[=:][^\s,;]+/gi, "grauth=[redacted]")
    .slice(0, max);
}

export async function writeLog(input: {
  level?: string;
  source?: string;
  action: string;
  message: string;
  email?: string | null;
  ip?: string | null;
}) {
  try {
    const level = LEVELS.has(String(input.level)) ? String(input.level) : "info";
    const source = SOURCES.has(String(input.source)) ? String(input.source) : "api";
    await prisma.eventLog.create({
      data: {
        level,
        source,
        action: clean(input.action, 80),
        message: clean(input.message, 500),
        email: input.email ? clean(input.email, 160).toLowerCase() : null,
        ip: input.ip ? clean(input.ip, 80) : null,
      },
    });
    if (Math.random() < 0.02) {
      const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      await prisma.eventLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    }
  } catch (error) {
    console.error("writeLog failed", error);
  }
}

export function requestIp(request: Request) {
  return clientIp(request);
}

export function parseClientLog(body: unknown) {
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const level = LEVELS.has(String(raw.level)) ? String(raw.level) : "error";
  const source = raw.source === "capture" ? "capture" : "apply";
  const action = clean(raw.action || "client", 80);
  const message = clean(raw.message || "Unknown client error", 500);
  if (!action || !message) return null;
  return { level, source, action, message };
}
