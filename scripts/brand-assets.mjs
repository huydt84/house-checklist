import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.resolve("next/package.json"));
const sharp = require("sharp");
const teal = "#17675f";
const paper = "#f5f7f7";
const mark = `<g fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 29 32 13 50 29M20 25v24h24V25"/><path d="m26 35 5 5 8-9"/></g>`;
const icon = (rounded = true) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="${rounded ? 14 : 0}" fill="${teal}"/>${mark}</svg>`;

await mkdir("public", { recursive: true });
await mkdir("app", { recursive: true });
await writeFile("public/icon.svg", icon());
for (const [file, size, rounded] of [
  ["app/apple-icon.png", 180, false],
  ["public/icon-192.png", 192, true],
  ["public/icon-512.png", 512, true],
  ["public/icon-maskable-512.png", 512, false],
]) {
  await sharp(Buffer.from(icon(rounded)))
    .resize(size, size)
    .png()
    .toFile(file);
}

// ICO supports PNG frames; include the common browser and desktop sizes.
const frames = await Promise.all(
  [16, 32, 48].map(async (size) => ({
    size,
    data: await sharp(Buffer.from(icon())).resize(size, size).png().toBuffer(),
  })),
);
const header = Buffer.alloc(6 + frames.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(frames.length, 4);
let offset = header.length;
frames.forEach(({ size, data }, index) => {
  const entry = 6 + index * 16;
  header[entry] = size;
  header[entry + 1] = size;
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(data.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += data.length;
});
await writeFile(
  "app/favicon.ico",
  Buffer.concat([header, ...frames.map((frame) => frame.data)]),
);

const background = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="${paper}"/><path d="M832 0h368v630H832z" fill="${teal}"/><g transform="translate(888 187) scale(4)">${mark}</g><path d="M80 514h664" stroke="#dce3e3" stroke-width="2"/></svg>`;
const fontfile = path.resolve("assets/brand/Geist.ttf");
async function lettering(text, size, color, weight = "Regular") {
  return sharp({
    text: {
      text: `<span foreground="${color}">${text}</span>`,
      font: `Geist ${weight} ${size}`,
      fontfile,
      rgba: true,
      dpi: 72,
    },
  })
    .png()
    .toBuffer();
}
const layers = [
  {
    input: await lettering("House", 92, "#242e31", "Semi-Bold"),
    left: 80,
    top: 90,
  },
  {
    input: await lettering("Checklist", 92, "#242e31", "Semi-Bold"),
    left: 80,
    top: 192,
  },
  {
    input: await lettering("Shortlist apartments.", 30, "#667477"),
    left: 84,
    top: 342,
  },
  {
    input: await lettering("Capture viewing notes.", 30, "#667477"),
    left: 84,
    top: 388,
  },
  {
    input: await lettering("Compare the details.", 30, "#667477"),
    left: 84,
    top: 434,
  },
  {
    input: await lettering("Private rental workspace", 22, teal, "Medium"),
    left: 84,
    top: 552,
  },
];
await sharp(Buffer.from(background))
  .composite(layers)
  .png()
  .toFile("app/opengraph-image.png");
await writeFile(
  "app/opengraph-image.alt.txt",
  "House Checklist — a private rental shortlist, viewing notes, and shared checklist.\n",
);
const sizes = await Promise.all(
  ["app/favicon.ico", "app/apple-icon.png", "app/opengraph-image.png"].map(
    async (file) => ({ file, bytes: (await readFile(file)).length }),
  ),
);
console.log(sizes);
