import { prisma } from "@/lib/db";
import { ensureSuperAdmin, userFromRequest } from "@/lib/auth";
import { json, options } from "@/lib/http";

export function OPTIONS(request: Request) {
  return options(request);
}

export async function GET(request: Request) {
  await ensureSuperAdmin();
  const user = await userFromRequest(request);
  if (!user) return json(request, { error: "Unauthorized." }, 401);

  const session = await prisma.session.findUnique({
    where: { userId: user.id },
    select: { updatedAt: true },
  });

  return json(request, {
    hasSession: Boolean(session),
    updatedAt: session?.updatedAt ?? null,
  });
}
