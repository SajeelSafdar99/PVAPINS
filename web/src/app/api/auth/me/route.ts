import { ensureSuperAdmin, userFromRequest } from "@/lib/auth";
import { json, options } from "@/lib/http";

export function OPTIONS(request: Request) {
  return options(request);
}

export async function GET(request: Request) {
  try {
    await ensureSuperAdmin();
  } catch {
    // env may be missing during static checks
  }
  const user = await userFromRequest(request);
  if (!user) return json(request, { error: "Unauthorized." }, 401);
  return json(request, { user });
}
