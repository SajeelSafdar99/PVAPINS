import { json, options } from "@/lib/http";

export function OPTIONS(request: Request) {
  return options(request);
}

export async function POST(request: Request) {
  return json(
    request,
    { error: "Users cannot upload sessions. The admin assigns a JSON to each user." },
    403
  );
}
