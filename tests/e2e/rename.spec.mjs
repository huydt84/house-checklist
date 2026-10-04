import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

const baseURL = "http://127.0.0.1:3001";
async function persona(context, role) {
  await context.addCookies([
    { name: "house-persona", value: role, url: baseURL },
  ]);
}
async function openCollectionRename(page) {
  await page
    .locator(".sidebar:visible,.mobile-tools:visible")
    .getByRole("button", { name: "Collection", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Rename collection", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Collection name"),
  ).toBeFocused();
}

test("names can be cancelled, validated and renamed offline without losing pending property edits", async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(90000);
  await persona(context, "owner");
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto("/?page=apartments");
  await expect(
    page.getByRole("heading", { name: "Apartments", exact: true }),
  ).toBeVisible();
  const session = await (await page.request.get("/api/session")).json();
  const cid = session.collections[0].id;
  const endpoint = `/api/collections/${cid}`;
  const original = await (await page.request.get(endpoint)).json();
  const name = `Browser ${Date.now()}`;
  const renamedName = `Browser ${Date.now() + 1}`;
  let apartmentId;
  try {
    await page
      .getByRole("button", { name: "Add apartment", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("Name", { exact: true })
      .fill(name);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    apartmentId = new URL(page.url()).searchParams.get("apartment");
    await expect(page.locator(".save-status")).toHaveText("Saved");

    // Inspect the affected surfaces together at every required breakpoint.
    for (const width of [320, 390, 1440, 1920]) {
      await page.setViewportSize({ width, height: width < 700 ? 850 : 1000 });
      await page
        .getByRole("button", { name: "Rename property", exact: true })
        .click();
      await expect(
        page.getByRole("dialog").getByLabel("Property name"),
      ).toHaveValue(name);
      await page.screenshot({
        path: testInfo.outputPath(`property-${width}.png`),
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      await openCollectionRename(page);
      await page.screenshot({
        path: testInfo.outputPath(`collection-${width}.png`),
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
    }
    await page.setViewportSize({ width: 390, height: 850 });
    await page
      .getByRole("button", { name: "Rename property", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Property name").fill("   ");
    await dialog
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toHaveText("Enter a name.");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();

    await context.setOffline(true);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await dialog.getByLabel("Room number", { exact: true }).fill("905");
    await dialog
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await page
      .getByRole("button", { name: "Rename property", exact: true })
      .click();
    await dialog.getByLabel("Property name").fill(`  ${renamedName}  `);
    await dialog.getByLabel("Property name").press("Enter");
    await expect(
      page.getByRole("heading", { name: renamedName, exact: true }),
    ).toBeVisible();
    await expect(page.locator(".save-status")).toContainText(
      "Saved on this device",
    );
    await openCollectionRename(page);
    await dialog
      .getByLabel("Collection name")
      .fill("  Renamed search 日本語  ");
    await dialog
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page.locator(".mobile-tools")).toContainText(
      "Renamed search 日本語",
    );
    await page
      .locator(".mobile-tools")
      .getByRole("button", { name: "Collection", exact: true })
      .click();
    await expect(
      page.getByRole("menuitem", {
        name: "Renamed search 日本語",
        exact: true,
      }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await context.setOffline(false);
    await expect(page.locator(".save-status")).toHaveText("Saved", {
      timeout: 30000,
    });
    await page.reload();
    await expect(
      page.getByRole("heading", { name: renamedName, exact: true }),
    ).toBeVisible();
    const saved = await (await page.request.get(endpoint)).json();
    const property = saved.apartments.find((a) => a.id === apartmentId);
    expect(property.name).toBe(renamedName);
    expect(property.room).toBe("905");
    expect(saved.collection.name).toBe("Renamed search 日本語");
    expect(saved.collection.settings).toEqual(original.collection.settings);
    await page
      .locator(".mobile-nav")
      .getByRole("link", { name: "Apartments", exact: false })
      .click();
    await expect(
      page.locator(".property-name").filter({ hasText: renamedName }),
    ).toBeVisible();
  } finally {
    await context.setOffline(false);
    const latest = await (await page.request.get(endpoint)).json();
    if (latest.collection.name !== original.collection.name) {
      const restored = await page.request.post(`${endpoint}/mutations`, {
        data: {
          id: randomUUID(),
          targetId: cid,
          type: "collection.put",
          expectedRevision: latest.collection.revision,
          payload: { name: original.collection.name },
        },
      });
      expect(restored.ok()).toBeTruthy();
    }
    const property = latest.apartments.find((a) => a.id === apartmentId);
    if (property) {
      const archived = await page.request.post(`${endpoint}/mutations`, {
        data: {
          id: randomUUID(),
          targetId: property.id,
          type: "apartment.put",
          expectedRevision: property.revision,
          payload: { archived: true },
        },
      });
      expect(archived.ok()).toBeTruthy();
    }
  }
});

for (const role of ["editor", "viewer"]) {
  test(`rename controls respect the ${role} role`, async ({
    page,
    context,
  }) => {
    await persona(context, role);
    await page.goto("/?page=apartments");
    await expect(
      page.getByRole("heading", { name: "Apartments", exact: true }),
    ).toBeVisible();
    await page.locator(".property-name").first().click();
    if (role === "editor")
      await expect(
        page.getByRole("button", { name: "Rename property", exact: true }),
      ).toBeVisible();
    else
      await expect(
        page.getByRole("button", { name: "Rename property", exact: true }),
      ).toHaveCount(0);
    await page
      .locator(".sidebar:visible,.mobile-tools:visible")
      .getByRole("button", { name: "Collection", exact: true })
      .click();
    const rename = page.getByRole("menuitem", {
      name: "Rename collection",
      exact: true,
    });
    if (role === "editor") await expect(rename).toBeVisible();
    else await expect(rename).toHaveCount(0);
    await page.keyboard.press("Escape");
  });
}
