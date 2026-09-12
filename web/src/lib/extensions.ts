import versions from "@/generated/extension-versions.json";

export const EXTENSIONS = {
  apply: {
    id: "apply" as const,
    filename: "pvapins-apply.zip",
    path: "/downloads/pvapins-apply.zip",
    version: versions.apply,
  },
  capture: {
    id: "capture" as const,
    filename: "pvapins-capture.zip",
    path: "/downloads/pvapins-capture.zip",
    version: versions.capture,
  },
};

export function extensionDownloadUrl(request: Request, path: string) {
  return new URL(path, request.url).toString();
}
