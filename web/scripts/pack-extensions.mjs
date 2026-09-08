import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "..");
const outDir = path.join(webRoot, "public", "downloads");

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "");

const packs = [
  { name: "capture", src: "extension-capture", zip: "pvapins-capture.zip" },
  { name: "apply", src: "extension-apply", zip: "pvapins-apply.zip" },
];

mkdirSync(outDir, { recursive: true });

for (const pack of packs) {
  const live = path.join(repoRoot, pack.src);
  const bundled = path.join(webRoot, "extensions", pack.name);
  const source = existsSync(live) ? live : bundled;
  if (!existsSync(source)) {
    throw new Error(`Missing extension folder: ${pack.src}`);
  }

  rmSync(bundled, { recursive: true, force: true });
  mkdirSync(path.dirname(bundled), { recursive: true });
  cpSync(source, bundled, {
    recursive: true,
    filter: (from) => !from.includes(".DS_Store"),
  });

  if (pack.name === "apply" || pack.name === "capture") {
    writeFileSync(
      path.join(bundled, "config.js"),
      `const DEFAULT_API_URL = ${JSON.stringify(siteUrl)};\n`
    );
  }

  const zipPath = path.join(outDir, pack.zip);
  rmSync(zipPath, { force: true });
  execSync(`zip -r "${zipPath}" . -x "*.DS_Store"`, { cwd: bundled, stdio: "inherit" });
  console.log(`packed ${pack.zip} (${readdirSync(bundled).length} files)`);
}
