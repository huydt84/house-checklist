import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { t } from "../lib/i18n.mjs";
const directory = process.argv[2] || ".impeccable/review";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const results = [];
const combinations = [
  ["en", "light", 1440],
  ["en", "dark", 390],
  ["ja", "light", 320],
  ["ja", "dark", 1440],
  ["vi", "light", 1920],
  ["vi", "dark", 390],
  ["en", "light", 435],
];
try {
  for (const [locale, theme, width] of combinations) {
    const context = await browser.newContext({
      viewport: { width, height: width < 700 ? 850 : 1000 },
      reducedMotion: "reduce",
    });
    await context.addCookies([
      { name: "house-persona", value: "owner", url: "http://127.0.0.1:3001" },
    ]);
    await context.request.post("http://127.0.0.1:3001/api/profile", {
      data: { locale },
    });
    await context.addInitScript(
      ({ locale, theme }) => {
        localStorage.setItem("house-language", locale);
        localStorage.setItem("house-theme", theme);
      },
      { locale, theme },
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:3001/?page=apartments");
    await page
      .getByRole("heading", { name: t(locale, "apartments"), exact: true })
      .waitFor();
    const capture = async (screen) => {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.evaluate(() => document.fonts.ready);
      const path = `${directory}/${screen}-${locale}-${theme}-${width}.png`;
      await page.screenshot({ path, fullPage: true });
      if (
        screen === "apartments" ||
        screen === "costs" ||
        screen === "viewing" ||
        screen === "preferences" ||
        screen === "compare"
      )
        await page.screenshot({ path: path.replace(".png", "-viewport.png") });
      const overflow = await page.evaluate(() => ({
        width: innerWidth,
        document: document.documentElement.scrollWidth,
        offenders: [...document.querySelectorAll("main *")]
          .filter((e) => {
            const r = e.getBoundingClientRect();
            return (
              r.right > innerWidth + 1 &&
              getComputedStyle(e).position !== "fixed" &&
              !e.closest(".desktop-compare")
            );
          })
          .slice(0, 8)
          .map((e) => ({ tag: e.tagName, text: e.textContent.slice(0, 45) })),
      }));
      results.push({
        screen,
        locale,
        theme,
        width,
        path,
        overflow,
        errors: [...errors],
      });
      console.log(
        `${screen} ${locale}/${theme}/${width}: overflow=${overflow.document > width}, errors=${errors.length}`,
      );
    };
    const nav = async (screen) => {
      if (width < 700 && ["checklist", "members"].includes(screen)) {
        await page
          .locator(".mobile-nav")
          .getByRole("link", { name: t(locale, "preferences"), exact: true })
          .click();
        await page
          .locator(".settings-mobile-tabs")
          .getByRole("button", { name: t(locale, screen), exact: true })
          .click();
      } else
        await page
          .locator(".sidebar:visible,.mobile-nav:visible")
          .getByRole("link", { name: t(locale, screen), exact: false })
          .first()
          .click();
    };
    await capture("apartments");
    if (width === 435) {
      await context.close();
      continue;
    }
    await page
      .getByRole("link", { name: "Kiyosumi Garden · 402", exact: true })
      .last()
      .click();
    await capture("overview");
    for (const screen of ["viewing", "costs", "travel", "photos"]) {
      await page
        .getByRole("tab", { name: t(locale, screen), exact: false })
        .click();
      await capture(screen);
    }
    await nav("apartments");
    for (const name of ["Kiyosumi Garden · 402", "Morishita Residence · 601"])
      await page
        .getByRole("checkbox", {
          name: `${t(locale, "selectCompare")}: ${name}`,
          exact: true,
        })
        .check();
    for (const screen of [
      "compare",
      "questions",
      "checklist",
      "preferences",
      "members",
    ]) {
      await nav(screen);
      await capture(screen);
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
if (results.some((r) => r.errors.length || r.overflow.document > r.width))
  process.exitCode = 1;
