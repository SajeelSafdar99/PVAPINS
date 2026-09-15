import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "..");
const outDir = path.join(webRoot, "public", "downloads");
const localDemo = !process.env.VERCEL && process.env.NODE_ENV !== "production";
const PRODUCTION_SITE = "https://seo.smspin.io";

const siteUrl = localDemo
  ? process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000"
  : process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : PRODUCTION_SITE);

const packs = [
  { name: "capture", src: "extension-capture", zip: "pvapins-capture.zip" },
  { name: "apply", src: "extension-apply", zip: "pvapins-apply.zip" },
];

function stripDemoHosts(manifestPath) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const drop = (list = []) => list.filter((value) => !String(value).includes("pvapins.com"));
  manifest.host_permissions = drop(manifest.host_permissions);
  const optional = drop(manifest.optional_host_permissions);
  if (optional.length) manifest.optional_host_permissions = optional;
  else delete manifest.optional_host_permissions;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

mkdirSync(outDir, { recursive: true });

const versions = {};

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

  const sharedSession = path.join(repoRoot, "shared", "session.js");
  if (existsSync(sharedSession)) {
    cpSync(sharedSession, path.join(bundled, "session.js"));
  }
  const sharedUpdate = path.join(repoRoot, "shared", "update.js");
  if (existsSync(sharedUpdate)) {
    cpSync(sharedUpdate, path.join(bundled, "update.js"));
  }
  const sharedNet = path.join(repoRoot, "shared", "net.js");
  if (existsSync(sharedNet)) {
    cpSync(sharedNet, path.join(bundled, "net.js"));
  }

  writeFileSync(
    path.join(bundled, "config.js"),
    `const DEFAULT_API_URL = ${JSON.stringify(siteUrl)};\nconst LOCAL_DEMO = ${localDemo};\n`
  );

  if (!localDemo) {
    stripDemoHosts(path.join(bundled, "manifest.json"));
  }

  const manifest = JSON.parse(readFileSync(path.join(bundled, "manifest.json"), "utf8"));
  versions[pack.name] = manifest.version;

  const zipPath = path.join(outDir, pack.zip);
  rmSync(zipPath, { force: true });
  execSync(`zip -r "${zipPath}" . -x "*.DS_Store"`, { cwd: bundled, stdio: "inherit" });
  console.log(`packed ${pack.zip} (${readdirSync(bundled).length} files) demo=${localDemo}`);
}

writeFileSync(
  path.join(webRoot, "src/generated/extension-versions.json"),
  `${JSON.stringify({ apply: versions.apply, capture: versions.capture }, null, 2)}\n`
);
