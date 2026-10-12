import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test.use({ serviceWorkers: "block" });

test("archiving in another tab removes properties from comparison and frees selection slots", async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(90000);
  await context.addCookies([
    { name: "house-persona", value: "owner", url: "http://127.0.0.1:3001" },
  ]);
  const response = await page.request.post("/api/collections", {
    data: { name: `Comparison archive ${randomUUID()}` },
  });
  expect(response.ok()).toBeTruthy();
  const collection = await response.json();
  const endpoint = `/api/collections/${collection.id}`;
  const other = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    const properties = [];
    for (const name of [
      "Archived first",
      "Archived second",
      "Active first",
      "Active second",
      "Replacement",
    ]) {
      const result = await page.request.post(`${endpoint}/mutations`, {
        data: {
          id: randomUUID(),
          type: "apartment.put",
          targetId: randomUUID(),
          expectedRevision: 0,
          payload: { name },
        },
      });
      expect(result.ok()).toBeTruthy();
      properties.push((await result.json()).record);
    }
    const parameters = new URLSearchParams({
      collection: collection.id,
      page: "compare",
      selected: properties
        .slice(0, 4)
        .map((a) => a.id)
        .join(","),
      pair: properties
        .slice(0, 2)
        .map((a) => a.id)
        .join(","),
    });
    const selectedIds = () =>
      (new URL(page.url()).searchParams.get("selected") || "")
        .split(",")
        .filter(Boolean);
    const archive = async (property) => {
      const row = other.locator(
        `.property-row[data-property-id="${property.id}"]`,
      );
      await row.getByRole("button", { name: "Archive", exact: true }).click();
      await other
        .getByRole("dialog", { name: "Archive apartment?" })
        .getByRole("button", { name: "Archive", exact: true })
        .click();
      await expect(row).toHaveCount(0);
      await expect(other.locator(".save-status")).toHaveText("Saved");
    };
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?${parameters}`);
    await expect(page.locator(".compare-picker input:checked")).toHaveCount(4);
    await other.goto(`/?collection=${collection.id}&page=apartments`);
    await archive(properties[0]);
    await archive(properties[1]);
    await page.reload();
    await expect(
      page.locator(".compare-picker").getByRole("checkbox", {
        name: properties[0].name,
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.locator(".desktop-compare thead").getByRole("link", {
        name: properties[0].name,
        exact: true,
      }),
    ).toHaveCount(0);
    await expect
      .poll(selectedIds)
      .toEqual(properties.slice(2, 4).map((a) => a.id));

    for (const width of [320, 390, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/?${parameters}`);
      await expect
        .poll(selectedIds)
        .toEqual(properties.slice(2, 4).map((a) => a.id));
      await expect(page.locator(".compare-picker input:checked")).toHaveCount(
        2,
      );
      const comparison = page.locator(
        width < 700 ? ".mobile-compare" : ".desktop-compare",
      );
      await expect(comparison).toBeVisible();
      for (const property of properties.slice(0, 2)) {
        await expect(
          page.locator(".compare-picker").getByRole("checkbox", {
            name: property.name,
            exact: true,
          }),
        ).toHaveCount(0);
        await expect(comparison).not.toContainText(property.name);
      }
      const replacement = page.getByRole("checkbox", {
        name: "Replacement",
        exact: true,
      });
      await expect(replacement).toBeEnabled();
      await replacement.check();
      await expect(page.locator(".compare-picker input:checked")).toHaveCount(
        3,
      );
      await replacement.uncheck();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await page.screenshot({
        path: testInfo.outputPath(`comparison-archive-${width}.png`),
      });
    }

    await archive(properties[2]);
    await page.reload();
    await expect.poll(selectedIds).toEqual([properties[3].id]);
    await expect(
      page.getByRole("button", { name: "Export PDF", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Export Excel", exact: true }),
    ).toBeDisabled();
    await expect(page.locator(".desktop-compare, .mobile-compare")).toHaveCount(
      0,
    );
    await page
      .getByRole("checkbox", { name: properties[3].name, exact: true })
      .uncheck();
    await expect.poll(selectedIds).toEqual([]);
    await page.reload();
    await expect(page.locator(".compare-picker input:checked")).toHaveCount(0);

    await other
      .getByRole("button", { name: "Show archived", exact: true })
      .click();
    const archivedRow = other.locator(
      `.property-row[data-property-id="${properties[0].id}"]`,
    );
    await expect(archivedRow.getByRole("checkbox")).toBeDisabled();
    await archivedRow
      .getByRole("button", { name: "Restore", exact: true })
      .click();
    await expect(other.locator(".save-status")).toHaveText("Saved");
    await page.reload();
    await expect(
      page.getByRole("checkbox", { name: properties[0].name, exact: true }),
    ).not.toBeChecked();
    await expect(page.locator(".save-status")).toHaveText("Saved");
    const added = await other.request.post(`${endpoint}/mutations`, {
      data: {
        id: randomUUID(),
        type: "apartment.put",
        targetId: randomUUID(),
        expectedRevision: 0,
        payload: { name: "New active property" },
      },
    });
    expect(added.ok()).toBeTruthy();
    const addedProperty = (await added.json()).record;
    const activeIds = [properties[0].id, addedProperty.id];
    let releaseChanges;
    const changesGate = new Promise((resolve) => {
      releaseChanges = resolve;
    });
    let changesRequested;
    const changesStarted = new Promise((resolve) => {
      changesRequested = resolve;
    });
    const changesRoute = `**${endpoint}/changes?**`;
    await page.route(changesRoute, async (route) => {
      changesRequested();
      await changesGate;
      await route.continue();
    });
    try {
      const deepLink = new URL(page.url());
      deepLink.searchParams.set("selected", activeIds.join(","));
      await page.goto(deepLink.href);
      await changesStarted;
      await expect(
        page.getByRole("checkbox", { name: properties[0].name, exact: true }),
      ).toBeChecked();
      expect(selectedIds()).toEqual(activeIds);
      releaseChanges();
      await expect(
        page.getByRole("checkbox", { name: addedProperty.name, exact: true }),
      ).toBeChecked();
    } finally {
      releaseChanges();
      await page.unrouteAll({ behavior: "wait" });
    }
    expect(errors).toEqual([]);
  } finally {
    await other.close();
    process.env.LOCAL_AUTH = "true";
    const { pool } = await import("../../lib/db.mjs");
    await pool().query("DELETE FROM collections WHERE id=$1", [collection.id]);
  }
});
