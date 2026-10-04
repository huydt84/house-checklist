import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { t } from "../lib/i18n.mjs";
const directory = ".impeccable/review/checklist-costs";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const results = [];
function contrast(foreground, background) {
  const luminance = (color) => {
    const [r, g, b] = color
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map((v) => {
        const x = Number(v) / 255;
        return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = luminance(foreground),
    b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
const combinations = [
  ["en", "light", 320],
  ["en", "light", 390],
  ["en", "light", 1440],
  ["en", "light", 1920],
  ["ja", "dark", 320],
  ["ja", "light", 1440],
  ["vi", "light", 390],
  ["vi", "dark", 1920],
];
try {
  for (const [locale, theme, width] of combinations) {
    const context = await browser.newContext({
      viewport: { width, height: 950 },
      reducedMotion: "reduce",
    });
    await context.addCookies([
      { name: "house-persona", value: "owner", url: "http://127.0.0.1:3001" },
    ]);
    await context.request.post("http://127.0.0.1:3001/api/profile", {
      data: { locale },
    });
    await context.addInitScript(
      (theme) => localStorage.setItem("house-theme", theme),
      theme,
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:3001");
    await page
      .getByRole("link", { name: "Kiyosumi Garden · 402", exact: true })
      .last()
      .click();
    const currentTheme = await page.evaluate(
      () => document.documentElement.dataset.theme,
    );
    if (currentTheme !== theme) {
      await page
        .getByRole("button", {
          name: t(locale, theme === "dark" ? "switchToDark" : "switchToLight"),
          exact: true,
        })
        .click();
    }
    for (const screen of ["overview", "viewing", "costs", "travel", "photos"]) {
      await page
        .getByRole("tab", { name: t(locale, screen), exact: false })
        .click();
      if (screen === "photos") {
        await page
          .getByRole("button", { name: t(locale, "addLink"), exact: true })
          .click();
        await page
          .getByRole("dialog")
          .getByLabel(t(locale, "name"), { exact: true })
          .fill("Listing reference");
      }
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => window.scrollTo(0, 0));
      const path = `${directory}/${screen}-${locale}-${theme}-${width}.png`;
      await page.screenshot({ path });
      if (screen === "costs") {
        await page.locator(".panel").first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.replace(".png", "-fields.png") });
        await page.locator(".record-list").scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.replace(".png", "-records.png") });
      }
      const metrics = await page.evaluate(() => ({
        width: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        badges: [...document.querySelectorAll(".check-heading > .chip")].map(
          (e) => ({
            text: e.textContent,
            visible: getComputedStyle(e).display !== "none",
          }),
        ),
        fieldStates: [
          ...document.querySelectorAll(".field[data-field-state]"),
        ].map((e) => ({
          state: e.dataset.fieldState,
          status: e.querySelector(".field-status")?.textContent,
          markerHeight: e
            .querySelector(".field-status")
            ?.getBoundingClientRect().height,
          visible:
            !!e.querySelector(".field-status") &&
            getComputedStyle(e.querySelector(".field-status")).display !==
              "none",
        })),
        recordFields: [
          ...document.querySelectorAll(
            ".cost-record-name .field-status, .cost-record-amount .field-status",
          ),
        ].map((e) => ({
          status: e.textContent,
          markerHeight: e.getBoundingClientRect().height,
          visible: getComputedStyle(e).display !== "none",
        })),
        answeredTextColors: [
          ...document.querySelectorAll(
            ".check-item .field-status, .check-item .check-heading p",
          ),
        ].map((e) => ({
          foreground: getComputedStyle(e).color,
          background: getComputedStyle(e.closest(".check-item"))
            .backgroundColor,
        })),
        badgeColors: [
          ...document.querySelectorAll(".check-heading > .chip"),
        ].map((e) => ({
          foreground: getComputedStyle(e).color,
          background: getComputedStyle(e).backgroundColor,
        })),
        deleteTargets: [...document.querySelectorAll(".cost-delete")].map(
          (e) => ({
            width: e.getBoundingClientRect().width,
            height: e.getBoundingClientRect().height,
          }),
        ),
      }));
      if (screen === "photos")
        await page
          .getByRole("dialog")
          .getByRole("button", { name: t(locale, "close"), exact: true })
          .click();
      results.push({
        screen,
        locale,
        theme,
        width,
        path,
        metrics,
        errors: [...errors],
      });
      console.log(
        `${screen} ${locale}/${theme}/${width}: overflow=${metrics.documentWidth > width}, errors=${errors.length}`,
      );
    }
    await context.request.post("http://127.0.0.1:3001/api/profile", {
      data: { locale: "en" },
    });
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(`${directory}/matrix.json`, JSON.stringify(results, null, 2));
}
if (
  results.some(
    (r) =>
      r.errors.length ||
      r.metrics.documentWidth > r.width ||
      r.metrics.badges.some((b) => !b.visible) ||
      r.metrics.fieldStates.some((f) => !f.visible || f.markerHeight >= 44) ||
      r.metrics.recordFields.some((f) => !f.visible || f.markerHeight >= 44) ||
      r.metrics.answeredTextColors.some(
        (c) => contrast(c.foreground, c.background) < 4.5,
      ) ||
      r.metrics.badgeColors.some(
        (c) => contrast(c.foreground, c.background) < 4.5,
      ) ||
      r.metrics.deleteTargets.some((b) => b.height < 44),
  )
)
  process.exitCode = 1;
