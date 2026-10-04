import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { t } from "../../lib/i18n.mjs";

const baseURL = "http://127.0.0.1:3001";

async function openChecklist(page, locale = "en", screenshotPath) {
  await page
    .locator(".sidebar:visible,.mobile-tools:visible")
    .getByRole("button", { name: t(locale, "collection"), exact: true })
    .click();
  await expect(
    page.getByRole("menuitem", {
      name: t(locale, "editChecklist"),
      exact: true,
    }),
  ).toBeVisible();
  if (screenshotPath) await page.screenshot({ path: screenshotPath });
  await page
    .getByRole("menuitem", { name: t(locale, "editChecklist"), exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: t(locale, "checklist"), exact: true }),
  ).toBeVisible();
}

test("collection checklist entry points preserve scope and show saved checks in their destination section", async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(90000);
  await context.addCookies([
    { name: "house-persona", value: "owner", url: baseURL },
  ]);
  const session = await (await page.request.get("/api/session")).json();
  const response = await page.request.post("/api/collections", {
    data: { name: `Checklist browser ${randomUUID()}` },
  });
  expect(response.ok()).toBeTruthy();
  const collection = await response.json();
  const endpoint = `/api/collections/${collection.id}`;
  const before = await (await page.request.get(endpoint)).json();
  const sections = [...before.sections].sort((a, b) => a.order - b.order);
  const name = "Building entrance during rain";
  try {
    // The menu and preferences link must reach this collection in every layout.
    for (const [width, locale, theme] of [
      [320, "ja", "light"],
      [390, "vi", "dark"],
      [1440, "en", "light"],
      [1920, "vi", "light"],
    ]) {
      await page.setViewportSize({ width, height: width < 700 ? 850 : 1000 });
      await page.request.post("/api/profile", { data: { locale } });
      await page.goto(`/?collection=${collection.id}`);
      await page.evaluate(
        ({ locale, theme }) => {
          localStorage.setItem("house-language", locale);
          localStorage.setItem("house-theme", theme);
        },
        { locale, theme },
      );
      await page.reload();
      await openChecklist(
        page,
        locale,
        testInfo.outputPath(`menu-${width}.png`),
      );
      await expect(page.locator(".page-description")).toContainText(
        collection.name,
      );
      expect(new URL(page.url()).searchParams.get("collection")).toBe(
        collection.id,
      );
      await page.screenshot({
        path: testInfo.outputPath(`checklist-${width}.png`),
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await page
        .getByRole("button", { name: t(locale, "addCriterion"), exact: true })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`editor-${width}.png`),
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await page.keyboard.press("Escape");
      await page.goto(`/?collection=${collection.id}&page=preferences`);
      await page
        .getByRole("link", { name: t(locale, "editChecklist"), exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: testInfo.outputPath(`preferences-${width}.png`),
      });
      await page
        .getByRole("link", { name: t(locale, "editChecklist"), exact: true })
        .click();
      await expect(
        page.getByRole("heading", {
          name: t(locale, "checklist"),
          exact: true,
        }),
      ).toBeVisible();
    }
    await page.request.post("/api/profile", { data: { locale: "en" } });
    await page.goto(
      `/?collection=${collection.id}&page=checklist&settingsSection=${sections[0].id}&checklistArchived=true`,
    );
    await page.evaluate(() => localStorage.setItem("house-language", "en"));
    await page.reload();
    await page
      .getByRole("button", { name: "Add a check", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Label · English", { exact: true }).fill(name);
    await dialog.getByLabel("Section", { exact: true }).click();
    await page
      .getByRole("option", { name: sections[1].labels.en, exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    let row = page.locator(".criteria-admin-row").filter({ hasText: name });
    await expect(row).toBeVisible();
    expect(new URL(page.url()).searchParams.get("settingsSection")).toBe(
      sections[1].id,
    );
    await row.getByRole("button", { name: "Edit", exact: true }).click();
    await dialog
      .getByLabel("Label · English", { exact: true })
      .fill(`${name} — updated`);
    await dialog
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await page.reload();
    row = page
      .locator(".criteria-admin-row")
      .filter({ hasText: `${name} — updated` });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Edit", exact: true }).click();
    await dialog.getByLabel("Archive", { exact: true }).check();
    await dialog
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByLabel(t("en", "showArchived"), { exact: true }),
    ).toBeChecked();
    await row.getByRole("button", { name: "Edit", exact: true }).click();
    await dialog.getByLabel("Archive", { exact: true }).uncheck();
    await dialog
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect(row).toBeVisible();
    await expect(
      page.getByLabel(t("en", "showArchived"), { exact: true }),
    ).not.toBeChecked();
    const saved = await (await page.request.get(endpoint)).json();
    const custom = saved.criteria.find(
      (c) => c.labels.en === `${name} — updated`,
    );
    expect(custom.sectionId).toBe(sections[1].id);
    expect(custom.archived).toBe(false);
    expect(saved.criteria).toHaveLength(before.criteria.length + 1);
  } finally {
    await page.request.post("/api/profile", {
      data: { locale: session.user.locale || "en" },
    });
    const { pool } = await import("../../lib/db.mjs");
    process.env.LOCAL_AUTH = "true";
    await pool().query("DELETE FROM collections WHERE id=$1 AND owner_id=$2", [
      collection.id,
      session.user.id,
    ]);
  }
});

test("checklist editing entry point is available to editors and absent for viewers", async ({
  page,
  context,
}) => {
  for (const role of ["editor", "viewer"]) {
    await context.addCookies([
      { name: "house-persona", value: role, url: baseURL },
    ]);
    await page.goto("/?page=apartments");
    await page
      .locator(".sidebar:visible,.mobile-tools:visible")
      .getByRole("button", { name: "Collection", exact: true })
      .click();
    const edit = page.getByRole("menuitem", {
      name: "Edit checklist",
      exact: true,
    });
    if (role === "editor") {
      await edit.click();
      await expect(
        page.getByRole("button", { name: "Add a check", exact: true }),
      ).toBeEnabled();
    } else {
      await expect(edit).toHaveCount(0);
      await page.keyboard.press("Escape");
      await page.goto("/?page=checklist");
      await expect(
        page.getByRole("button", { name: "Add a check", exact: true }),
      ).toBeDisabled();
    }
  }
});
