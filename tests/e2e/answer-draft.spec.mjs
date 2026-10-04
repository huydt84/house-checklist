import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let output, script, styles;
test.beforeAll(async () => {
  // Compile the actual component and shared fields; only its async context is controlled.
  await require("next/dist/build/swc").loadBindings();
  const { webpack } = require("next/dist/compiled/webpack/webpack");
  output = await mkdtemp(join(tmpdir(), "house-answer-draft-"));
  await new Promise((resolve, reject) => {
    const compiler = webpack({
      mode: "development",
      devtool: false,
      entry: fileURLToPath(
        new URL("./fixtures/answer-draft.jsx", import.meta.url),
      ),
      output: { path: output, filename: "bundle.js" },
      resolve: { extensions: [".js", ".jsx", ".mjs"] },
      module: {
        rules: [
          {
            test: /\.jsx$/,
            exclude: /node_modules/,
            use: fileURLToPath(
              new URL("./fixtures/jsx-loader.cjs", import.meta.url),
            ),
          },
        ],
      },
    });
    compiler.run((error, stats) => {
      compiler.close(() => {
        if (error || stats.hasErrors())
          reject(
            error || new Error(stats.toString({ all: false, errors: true })),
          );
        else resolve();
      });
    });
  });
  script = await readFile(join(output, "bundle.js"), "utf8");
  styles = await readFile(
    new URL("../../app/globals.css", import.meta.url),
    "utf8",
  );
});
test.afterAll(async () => {
  if (output) await rm(output, { recursive: true, force: true });
});

test.beforeEach(async ({ page }) => {
  await page.route("**/__answer-draft", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<style>${styles}</style><div id="root"></div><script>${script.replaceAll("</script>", "<\\/script>")}</script>`,
    }),
  );
  await page.goto("/__answer-draft");
});

test("not applicable changes only through the checkbox across screen sizes", async ({
  page,
}) => {
  const row = page.locator(".answer-input > .toggle-label");
  const input = page.getByRole("spinbutton");
  const checkbox = page.getByRole("checkbox", {
    name: "Not applicable",
    exact: true,
  });
  for (const width of [320, 390, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await input.fill("1986");
    await row.click({ position: { x: 8, y: 22 } });
    await expect(checkbox).not.toBeChecked();
    await expect(input).toHaveValue("1986");
    await row.locator("span").click();
    await expect(checkbox).not.toBeChecked();
    await expect(input).toHaveValue("1986");
    await checkbox.click();
    await expect(checkbox).toBeChecked();
    await row.click({ position: { x: 8, y: 22 } });
    await row.locator("span").click();
    await expect(checkbox).toBeChecked();
    await checkbox.focus();
    await checkbox.press("Space");
    await expect(checkbox).not.toBeChecked();
  }
});

test("blur preserves the latest draft while older snapshots and overlapping local saves arrive", async ({
  page,
}) => {
  const input = page.getByRole("spinbutton");
  const emptySurface = await input.evaluate(
    (e) => getComputedStyle(e).backgroundColor,
  );
  await input.fill("1");
  await input.fill("1986");
  await page.locator(".check-heading").click();
  await expect(input).not.toBeFocused();
  await page.evaluate(() => window.answerDraft.broadcast({ value: null }));
  await expect(input).toHaveValue("1986");
  await page.evaluate(() => {
    window.answerDraft.saves[0].resolve();
    window.answerDraft.broadcast({ value: 1, state: "answered" });
  });
  await expect(input).toHaveValue("1986");
  await expect(input).toHaveAccessibleDescription("Filled");
  expect(
    await input.evaluate((e) => getComputedStyle(e).backgroundColor),
  ).not.toBe(emptySurface);
  await page.evaluate(async () => {
    window.answerDraft.saves[1].resolve();
    // Let the save promise settle before delivering an authoritative update.
    await new Promise((resolve) => setTimeout(resolve, 0));
    window.answerDraft.broadcast({
      value: 2008,
      state: "answered",
      revision: 3,
    });
  });
  await expect(input).toHaveValue("2008");
});
