import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("journey modal preserves Travel context on close, save, reload and browser history", async ({
  page,
}, testInfo) => {
  process.env.LOCAL_AUTH = "true";
  const { localUser, createCollection, mutate } =
    await import("../../lib/repository.mjs");
  const { pool, closeDb } = await import("../../lib/db.mjs");
  const owner = await localUser("owner");
  const collection = await createCollection(
    owner,
    `Travel browser ${randomUUID()}`,
  );
  const apartmentId = randomUUID();
  try {
    await mutate(collection.id, owner, {
      id: randomUUID(),
      targetId: apartmentId,
      type: "apartment.put",
      expectedRevision: 0,
      payload: { name: "Travel navigation apartment" },
    });
    await page
      .context()
      .addCookies([
        { name: "house-persona", value: "owner", url: "http://127.0.0.1:3001" },
      ]);
    await page.goto(
      `/?collection=${collection.id}&page=apartments&apartment=${apartmentId}&tab=travel`,
    );
    const travelTab = page.getByRole("tab", { name: "Travel", exact: true });
    await expect(travelTab).toHaveAttribute("aria-selected", "true");
    const returnUrl = page.url();
    const addJourney = page.getByRole("button", {
      name: "Add journey scenario",
      exact: true,
    });
    const dialog = page.getByRole("dialog", {
      name: "Journey scenario",
      exact: true,
    });
    for (const width of [320, 390, 1440, 1920]) {
      await page.setViewportSize({ width, height: width < 700 ? 850 : 1000 });
      await addJourney.click();
      await expect(dialog).toBeVisible();
      await expect(page).toHaveURL(`${returnUrl}&scenarioEditor=new`);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      const bounds = await dialog.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      await page.screenshot({
        path: testInfo.outputPath(`travel-modal-${width}.png`),
      });
      const saveButton = dialog.getByRole("button", {
        name: "Save changes",
        exact: true,
      });
      await saveButton.scrollIntoViewIfNeeded();
      await expect(saveButton).toBeInViewport();
      await dialog.getByRole("button", { name: "Close", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page).toHaveURL(returnUrl);
      await expect(travelTab).toHaveAttribute("aria-selected", "true");

      await addJourney.click();
      await expect(dialog).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(page).toHaveURL(returnUrl);
    }

    await addJourney.click();
    await expect(dialog).toBeVisible();
    const editorUrl = page.url();
    await page.goBack();
    await expect(page).toHaveURL(returnUrl);
    await expect(dialog).toHaveCount(0);
    await page.goForward();
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(editorUrl);
    await page.reload();
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Name", { exact: true }).fill("Regular commute");
    page.once("dialog", (prompt) => prompt.dismiss());
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue(
      "Regular commute",
    );
    await expect(page).toHaveURL(editorUrl);
    page.once("dialog", (prompt) => prompt.accept());
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(returnUrl);

    await addJourney.click();
    await dialog.getByLabel("Name", { exact: true }).fill("Regular commute");
    await dialog.getByLabel("Person", { exact: true }).fill("Travel fixture");
    await dialog.getByLabel("Arrival origin", { exact: true }).fill("Home");
    await dialog.getByLabel("Destination", { exact: true }).fill("Office");
    await dialog.getByLabel("Return destination", { exact: true }).fill("Home");
    await dialog.getByLabel("Journeys per period", { exact: true }).fill("5");
    await dialog
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(returnUrl);
    await expect(travelTab).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".journey-map")).toContainText("Office");
    await page.reload();
    await expect(page.locator(".journey-map")).toContainText("Office");

    await page
      .locator(".sidebar:visible,.mobile-nav:visible")
      .getByRole("link", { name: "Search preferences", exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: "Search preferences", exact: true }),
    ).toBeVisible();
    const preferencesUrl = page.url();
    await page
      .locator(".record-row")
      .filter({ hasText: "Regular commute" })
      .getByRole("button", { name: "Edit", exact: true })
      .click();
    await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue(
      "Regular commute",
    );
    await dialog.getByLabel("Destination", { exact: true }).fill("New office");
    await dialog
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(preferencesUrl);
    await expect(
      page.locator(".record-row").filter({ hasText: "Regular commute" }),
    ).toContainText("New office");
    await addJourney.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page).toHaveURL(preferencesUrl);
  } finally {
    await pool().query("DELETE FROM collections WHERE id=$1", [collection.id]);
    await closeDb();
  }
});
