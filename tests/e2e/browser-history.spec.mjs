import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("browser Back and Forward restore the collections home and each visited collection", async ({
  page,
}) => {
  // Real, isolated loopback DB fixtures; never add a production collection.
  process.env.LOCAL_AUTH = "true";
  const { localUser, upsertUser, createCollection, listCollections, mutate } =
    await import("../../lib/repository.mjs");
  const { pool, closeDb } = await import("../../lib/db.mjs");
  const owner = await localUser("owner");
  const original = (await listCollections(owner))[0];
  const fixtureOwner = await upsertUser({
    sub: `history:${randomUUID()}`,
    email: `${randomUUID()}@example.test`,
    name: "History fixture",
  });
  let collection;
  try {
    collection = await createCollection(
      fixtureOwner,
      `Browser history ${randomUUID()}`,
    );
    await pool().query(
      "INSERT INTO memberships(collection_id,user_id,role) VALUES($1,$2,'viewer')",
      [collection.id, owner.id],
    );
    await mutate(collection.id, fixtureOwner, {
      id: randomUUID(),
      targetId: randomUUID(),
      type: "apartment.put",
      expectedRevision: 0,
      payload: { name: "History fixture apartment" },
    });
    await page
      .context()
      .addCookies([
        { name: "house-persona", value: "owner", url: "http://127.0.0.1:3001" },
      ]);
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Collections", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("list", { name: "Collections", exact: true })
      .getByRole("link", { name: original.name, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Apartments", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Collection", exact: true })
      .filter({ visible: true })
      .click();
    await page
      .getByRole("menuitem", { name: collection.name, exact: true })
      .click();
    await expect(page.locator(".property-name")).toHaveText(
      "History fixture apartment",
    );
    await page.goBack();
    await expect(
      page.locator(".property-name").filter({ hasText: "Kiyosumi Garden" }),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`collection=${original.id}`));
    await page.goBack();
    await expect(
      page.getByRole("heading", { name: "Collections", exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL("http://127.0.0.1:3001/");
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`collection=${original.id}`));
    await page.goForward();
    await expect(page.locator(".property-name")).toHaveText(
      "History fixture apartment",
    );
    await page.reload();
    await expect(page.locator(".property-name")).toHaveText(
      "History fixture apartment",
    );
    await page.locator(".property-name").click();
    await page.getByRole("tab", { name: "Costs", exact: true }).click();
    await page
      .getByRole("button", { name: "Collection", exact: true })
      .filter({ visible: true })
      .click();
    await expect(
      page.getByRole("menuitem", { name: original.name, exact: true }),
    ).toHaveAttribute("href", new RegExp(`collection=${original.id}`));
    await page
      .getByRole("menuitem", { name: original.name, exact: true })
      .click();
    await expect(
      page.locator(".property-name").filter({ hasText: "Kiyosumi Garden" }),
    ).toBeVisible();
    await page.goBack();
    await expect(
      page.getByRole("heading", {
        name: "History fixture apartment",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Costs", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
  } finally {
    if (collection)
      await pool().query("DELETE FROM collections WHERE id=$1", [
        collection.id,
      ]);
    await pool().query("DELETE FROM users WHERE id=$1", [fixtureOwner.id]);
    await closeDb();
  }
});
