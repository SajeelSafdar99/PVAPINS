import { json, options } from "@/lib/http";
import { EXTENSIONS, extensionDownloadUrl } from "@/lib/extensions";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export function OPTIONS(request: Request) {
  return options(request);
}

export async function GET(request: Request) {
  const limited = rateLimit(`ext-version:${clientIp(request)}`, 60, 60 * 1000);
  if (!limited.ok) {
    return json(request, { error: "Too many requests. Try again shortly." }, 429);
  }

  return json(request, {
    apply: {
      version: EXTENSIONS.apply.version,
      zip: extensionDownloadUrl(request, EXTENSIONS.apply.path),
      filename: EXTENSIONS.apply.filename,
    },
    capture: {
      version: EXTENSIONS.capture.version,
      zip: extensionDownloadUrl(request, EXTENSIONS.capture.path),
      filename: EXTENSIONS.capture.filename,
    },
  });
}
