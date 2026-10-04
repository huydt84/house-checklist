import { readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const migrationsDir = fileURLToPath(new URL("../migrations/", import.meta.url));
const name = String(process.argv[2] || "")
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

if (!name) {
  console.error(
    "Provide a migration name, for example: pnpm db:migration:new add-apartment-status",
  );
  process.exitCode = 1;
} else {
  const highest = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .map((file) => Number(/^(\d+)_/.exec(file)?.[1]))
    .filter(Number.isSafeInteger)
    .reduce((maximum, id) => Math.max(maximum, id), 0);
  const id = Math.max(Date.now(), highest + 1);
  const path = `${migrationsDir}${id}_${name}.sql`;
  await writeFile(path, "-- Add the forward-only SQL schema change here.\n", {
    flag: "wx",
  });
  console.log(`Created ${path}`);
}
