import {
  readdir,
  readFile,
  writeFile,
  mkdir,
  copyFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import path from "node:path";
const require = createRequire(import.meta.url);
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory()
          ? walk(path.join(dir, e.name))
          : [path.join(dir, e.name)],
      ),
    )
  ).flat();
}
await mkdir("public/offline-lib", { recursive: true });
for (const pkg of [
  "workbox-sw",
  "workbox-core",
  "workbox-precaching",
  "workbox-routing",
  "workbox-strategies",
]) {
  const directory = path.dirname(require.resolve(`${pkg}/package.json`));
  for (const file of await readdir(path.join(directory, "build")))
    if (file.endsWith(".js"))
      await copyFile(
        path.join(directory, "build", file),
        path.join("public/offline-lib", file),
      );
}
const buildId = (await readFile(".next/BUILD_ID", "utf8")).trim();
const assets = (await walk(".next/static"))
  .filter((p) => !p.endsWith(".map"))
  .map((p) => ({ url: "/_next/" + p.replace(".next/", ""), revision: null }));
for (const file of await walk("public/fonts/pdf")) {
  if (!file.endsWith(".ttf")) continue;
  assets.push({
    url: "/" + file.replace("public/", ""),
    revision: createHash("sha256")
      .update(await readFile(file))
      .digest("hex"),
  });
}
assets.push(
  { url: "/offline", revision: buildId },
  { url: "/", revision: buildId },
);
const worker = `importScripts('/offline-lib/workbox-sw.js');
workbox.setConfig({modulePathPrefix:'/offline-lib/',debug:false});
workbox.core.setCacheNameDetails({prefix:'house-checklist',suffix:'${buildId}'});
// Navigations must check the server before the precached root can match them.
workbox.routing.registerRoute(({request,url})=>request.mode==='navigate'&&!url.pathname.startsWith('/api/'),new workbox.strategies.NetworkFirst({cacheName:'house-pages-${buildId}',networkTimeoutSeconds:4}));
workbox.precaching.precacheAndRoute(${JSON.stringify(assets)});
workbox.precaching.cleanupOutdatedCaches();
workbox.routing.setCatchHandler(async({event})=>event.request.mode==='navigate'?workbox.precaching.matchPrecache('/offline'):Response.error());
self.addEventListener('install',()=>self.skipWaiting());
workbox.core.clientsClaim();
self.addEventListener('message',event=>{if(event.data==='ACTIVATE')self.skipWaiting();});
`;
await writeFile("public/sw.js", worker);
console.log(
  `Built offline shell (${assets.length} assets, ${createHash("sha256").update(worker).digest("hex").slice(0, 8)})`,
);
