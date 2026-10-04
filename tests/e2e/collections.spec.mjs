import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { t } from "../../lib/i18n.mjs";

test("collection archive and restore persist, handle failures, and respect roles across widths", async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  const origin = "http://127.0.0.1:3001";
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await context.addCookies([
    { name: "house-persona", value: "owner", url: origin },
  ]);
  const response = await page.request.post("/api/collections", {
    data: { id: randomUUID(), name: `Archive browser ${randomUUID()}` },
  });
  expect(response.status()).toBe(201);
  const collection = await response.json();
  const endpoint = `/api/collections/${collection.id}`;
  const directory = `.impeccable/collection-archive-review/${test.info().project.name}`;
  await mkdir(directory, { recursive: true });
  const row = () =>
    page.getByRole("listitem").filter({ hasText: collection.name });
  try {
    const created = await page.request.post(`${endpoint}/mutations`, {
      data: {
        id: randomUUID(),
        type: "apartment.put",
        targetId: randomUUID(),
        expectedRevision: 0,
        payload: { name: "Archive keeps my property" },
      },
    });
    expect(created.ok()).toBeTruthy();
    const before = await (await page.request.get(endpoint)).json();
    await page.goto(`/?collection=${collection.id}`);
    await expect(
      page.getByRole("heading", { name: "Apartments", exact: true }),
    ).toBeVisible();
    await page.goto("/");
    await expect(row()).toBeVisible();
    await context.setOffline(true);
    await expect(
      row().getByRole("button", { name: "Archive", exact: true }),
    ).toBeDisabled();
    await context.setOffline(false);
    await expect(
      row().getByRole("button", { name: "Archive", exact: true }),
    ).toBeEnabled();
    await page.route(`**${endpoint}/mutations`, (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "SERVER_ERROR" }),
      }),
    );
    await row().getByRole("button", { name: "Archive", exact: true }).click();
    await expect(
      page.locator(".collections-screen").getByRole("alert"),
    ).toBeVisible();
    await expect(row()).toBeVisible();
    await page.unroute(`**${endpoint}/mutations`);
    // Another device changes the revision; refresh after conflict permits a retry.
    const updated = await page.request.post(`${endpoint}/mutations`, {
      data: {
        id: randomUUID(),
        type: "collection.put",
        targetId: collection.id,
        expectedRevision: before.collection.revision,
        payload: { settings: { budget: 123456 } },
      },
    });
    expect(updated.ok()).toBeTruthy();
    await row().getByRole("button", { name: "Archive", exact: true }).click();
    await expect(
      page.locator(".collections-screen").getByRole("alert"),
    ).toContainText("newer version");
    await expect(
      row().getByRole("button", { name: "Archive", exact: true }),
    ).toBeEnabled();
    await row().getByRole("button", { name: "Archive", exact: true }).click();
    await expect(row()).toHaveCount(0);
    await expect(
      page.locator(".collections-screen").getByRole("status"),
    ).toContainText("Collection archived");
    await page.reload();
    await expect(row()).toHaveCount(0);
    await page
      .getByRole("button", { name: "Collection", exact: true })
      .filter({ visible: true })
      .click();
    await expect(
      page.getByRole("menuitem", { name: collection.name, exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Show archived", exact: true })
      .click();
    await expect(row()).toBeVisible();
    await page.reload();
    await expect(
      row().getByRole("button", { name: "Restore", exact: true }),
    ).toBeEnabled();
    const saved = await (await page.request.get(endpoint)).json();
    expect(saved.collection.archived).toBe(true);
    expect(saved.apartments).toEqual(before.apartments);
    expect(saved.criteria).toEqual(before.criteria);
    expect(saved.collection.settings.budget).toBe(123456);
    for (const [locale, theme, width] of [
      ["ja", "light", 320],
      ["vi", "dark", 390],
      ["en", "light", 1440],
      ["en", "dark", 1920],
    ]) {
      await page.request.post("/api/profile", { data: { locale } });
      await page.evaluate(
        (theme) => localStorage.setItem("house-theme", theme),
        theme,
      );
      await page.setViewportSize({ width, height: width < 700 ? 850 : 1000 });
      await page.reload();
      await expect(
        row().getByRole("button", { name: t(locale, "restore"), exact: true }),
      ).toBeEnabled();
      await page.screenshot({
        path: `${directory}/archived-${width}.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await row()
        .getByRole("button", { name: t(locale, "restore"), exact: true })
        .click();
      await expect(row()).toHaveCount(0);
      await page
        .getByRole("button", { name: t(locale, "collections"), exact: true })
        .click();
      await expect(
        row().getByRole("button", { name: t(locale, "archive"), exact: true }),
      ).toBeEnabled();
      await page.screenshot({
        path: `${directory}/active-${width}.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await row()
        .getByRole("button", { name: t(locale, "archive"), exact: true })
        .click();
      await expect(row()).toHaveCount(0);
      await page
        .getByRole("button", { name: t(locale, "showArchived"), exact: true })
        .click();
    }
    await page.request.post("/api/profile", { data: { locale: "en" } });
    await page.reload();
    await row().getByRole("button", { name: "Restore", exact: true }).click();
    await expect(row()).toHaveCount(0);
    await page.goto("/");
    await row()
      .getByRole("link", { name: collection.name, exact: true })
      .click();
    await expect(page.locator(".property-name")).toHaveText(
      "Archive keeps my property",
    );
    for (const role of ["editor", "viewer"]) {
      await context.addCookies([
        { name: "house-persona", value: role, url: origin },
      ]);
      await page.goto("/");
      await expect(
        page.getByRole("heading", { name: "Collections", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("list", { name: "Collections", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Archive", exact: true }),
      ).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  } finally {
    await context.setOffline(false).catch(() => {});
    await context
      .addCookies([{ name: "house-persona", value: "owner", url: origin }])
      .catch(() => {});
    await page.request
      .post("/api/profile", { data: { locale: "en" } })
      .catch(() => {});
    process.env.LOCAL_AUTH = "true";
    const { pool, closeDb } = await import("../../lib/db.mjs");
    try {
      await pool().query(
        "DELETE FROM collections WHERE id=$1 AND owner_id=$2",
        [collection.id, collection.ownerId],
      );
    } finally {
      await closeDb();
    }
  }
});

test("opening the root shows collections even after visiting a collection", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "house-persona", value: "owner", url: "http://127.0.0.1:3001" },
  ]);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Collections", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL("http://127.0.0.1:3001/");
  await page
    .getByRole("list", { name: "Collections", exact: true })
    .getByRole("link")
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Apartments", exact: true }),
  ).toBeVisible();
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Collections", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL("http://127.0.0.1:3001/");
});

test("an owner can navigate, create, edit, and reopen collections", async ({
  page,
  context,
}, testInfo) => {
  await context.addCookies([
    { name: "house-persona", value: "owner", url: "http://127.0.0.1:3001" },
  ]);
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto("/?page=apartments");
  await expect(
    page.getByRole("heading", { name: "Apartments", exact: true }),
  ).toBeVisible();
  const session = await (await page.request.get("/api/session")).json();
  const original = session.collections.find((c) => c.role === "owner");
  expect(original).toBeTruthy();
  const names = [1, 2].map((n) => `Collection browser ${randomUUID()} ${n}`);
  const created = [];
  const openCollections = () =>
    page.locator(".brand:visible,.mobile-brand:visible").click();
  const openMenu = () =>
    page
      .getByRole("button", { name: "Collection", exact: true })
      .filter({ visible: true })
      .click();
  try {
    await openMenu();
    await page
      .getByRole("menuitem", { name: "Edit checklist", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Shared checklist", exact: true }),
    ).toBeVisible();
    await page.locator(".collection-home-link:visible").click();
    await expect(
      page.getByRole("heading", { name: "Apartments", exact: true }),
    ).toBeVisible();
    await openCollections();
    await expect(
      page.getByRole("heading", { name: "Collections", exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(/page=collections/);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Collections", exact: true }),
    ).toBeVisible();
    for (const name of names) {
      const create = page.getByRole("button", {
        name: "Create a collection",
        exact: true,
      });
      await expect(create).toBeEnabled();
      await create.click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Collection name").fill(name);
      const response = page.waitForResponse(
        (r) =>
          r.url().endsWith("/api/collections") &&
          r.request().method() === "POST",
      );
      await dialog.getByRole("button", { name: "Create", exact: true }).click();
      const result = await response;
      expect(result.status()).toBe(201);
      const collection = await result.json();
      created.push(collection);
      await expect(dialog).toHaveCount(0);
      await expect(page).toHaveURL(new RegExp(`collection=${collection.id}`));
      await expect(page.locator(".property-name")).toHaveCount(0);
      await openCollections();
    }
    const renamed = `Edited collection ${randomUUID()}`;
    names.push(renamed);
    const editedRow = page
      .getByRole("listitem")
      .filter({ hasText: created[0].name });
    await editedRow
      .getByRole("link", { name: "Edit collection", exact: true })
      .click();
    await expect(page).toHaveURL(
      (url) =>
        url.searchParams.get("collection") === created[0].id &&
        url.searchParams.get("page") === "preferences",
    );
    const form = page
      .locator("form")
      .filter({ has: page.getByLabel("Name", { exact: true }) });
    await form.getByLabel("Name", { exact: true }).fill(renamed);
    await form
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page.locator(".collection-home-link:visible")).toHaveText(
      renamed,
    );
    await expect
      .poll(async () => {
        const result = await (
          await page.request.get(`/api/collections/${created[0].id}`)
        ).json();
        return result.collection.name;
      })
      .toBe(renamed);
    created[0].name = renamed;
    await openCollections();
    await expect(
      page.getByRole("listitem").filter({ hasText: renamed }),
    ).toBeVisible();
    await page.goBack();
    await expect(
      page.getByRole("heading", { name: "Search preferences", exact: true }),
    ).toBeVisible();
    await page.goForward();
    await expect(
      page.getByRole("heading", { name: "Collections", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Collections", exact: true }),
    ).toBeVisible();
    for (const width of [320, 390, 1440, 1920]) {
      await page.setViewportSize({ width, height: width < 700 ? 850 : 1000 });
      await openCollections();
      await expect(
        page
          .getByRole("list", { name: "Collections", exact: true })
          .getByRole("link", { name: renamed, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Create a collection", exact: true }),
      ).toBeEnabled();
      await page.screenshot({
        path: testInfo.outputPath(`collections-list-${width}.png`),
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await openMenu();
      await expect(
        page.getByRole("menuitem", {
          name: "Create a collection",
          exact: true,
        }),
      ).toBeEnabled();
      for (const c of [original, ...created])
        await expect(
          page.getByRole("menuitem", { name: c.name, exact: true }),
        ).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`collections-${width}.png`),
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await page
        .getByRole("menuitem", { name: original.name, exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`collection=${original.id}`));
      await expect(page.locator(".property-name").first()).toBeVisible();
      await openMenu();
      await page
        .getByRole("menuitem", { name: created[0].name, exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`collection=${created[0].id}`));
      await expect(page.locator(".property-name")).toHaveCount(0);
    }
  } finally {
    // Remove only this test's collections from the isolated local database.
    process.env.LOCAL_AUTH = "true";
    process.env.LOCAL_POSTGRES_URI =
      "postgresql://house:house_local@127.0.0.1:55433/house_local";
    const { pool, closeDb } = await import("../../lib/db.mjs");
    try {
      await pool().query(
        "DELETE FROM collections WHERE owner_id=$1 AND name=ANY($2::text[])",
        [session.user.id, names],
      );
    } finally {
      await closeDb();
    }
  }
});
