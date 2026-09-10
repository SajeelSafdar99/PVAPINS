export function allowDemoSessions() {
  if (process.env.VERCEL) return false;
  return process.env.NODE_ENV !== "production";
}
