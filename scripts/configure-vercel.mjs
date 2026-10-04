import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";

// Credentials go through stdin, never command arguments or console output.
const values = parseEnv(readFileSync(".env", "utf8"));
const productionURL = values.PRODUCTION_APP_URL || values.APP_URL;
if (!productionURL?.startsWith("https://"))
  throw new Error("Set PRODUCTION_APP_URL to the HTTPS production address");
const hosted = {
  ...values,
  AUTH_URL: productionURL,
  APP_URL: productionURL,
  APP_ENV: "production",
};
const secretKeys = new Set([
  "AUTH_SECRET",
  "OAUTH_ENCRYPTION_KEY",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "POSTGRES_URI",
  "BLOB_READ_WRITE_TOKEN",
]);
const keys = [...secretKeys, "AUTH_URL", "APP_URL", "APP_ENV"];
if (values.LOCAL_AUTH)
  throw new Error("LOCAL_AUTH is forbidden for hosted environments");
// Validate the complete source before changing any hosted configuration.
for (const key of keys) {
  if (!hosted[key]?.trim()) throw new Error(`${key} is missing from .env`);
}
const project = JSON.parse(readFileSync(".vercel/project.json", "utf8"));
if (project.projectName !== "house-checklist")
  throw new Error("Link this checkout to the house-checklist Vercel project");
for (const key of keys) {
  const secret = secretKeys.has(key);
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "vercel",
      "env",
      "add",
      key,
      "production",
      "--scope",
      "huydts-projects",
      "--project",
      "house-checklist",
      "--yes",
      "--force",
      "--visibility",
      secret ? "secret" : "config",
      secret ? "--sensitive" : "--no-sensitive",
    ],
    { input: hosted[key], encoding: "utf8" },
  );
  if (result.status !== 0) {
    console.error(
      `Failed to configure ${key}; provider output suppressed to protect credentials.`,
    );
    process.exit(1);
  }
  console.log(`Configured ${key} (${secret ? "Secret" : "Config"})`);
}
