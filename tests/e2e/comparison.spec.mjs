import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("comparison filters the displayed mobile pair and updates when selected properties change", async ({
  page,
}, testInfo) => {
  await page
    .context()
    .addCookies([
      { name: "house-persona", value: "owner", url: "http://127.0.0.1:3001" },
    ]);
  const response = await page.request.post("/api/collections", {
    data: { name: `Comparison ${randomUUID()}` },
  });
  expect(response.ok()).toBeTruthy();
  const collection = await response.json();
  const endpoint = `/api/collections/${collection.id}`;
  try {
    const properties = [];
    const mutate = async (command) => {
      const result = await page.request.post(`${endpoint}/mutations`, {
        data: {
          id: randomUUID(),
          targetId: randomUUID(),
          expectedRevision: 0,
          ...command,
        },
      });
      expect(result.ok()).toBeTruthy();
      return (await result.json()).record;
    };
    for (const name of ["Compare first", "Compare second", "Compare third"])
      properties.push(
        await mutate({ type: "apartment.put", payload: { name } }),
      );
    await mutate({
      type: "scenario.put",
      payload: {
        person: "Renter",
        name: "Unpriced commute",
        purpose: "work",
        frequencyUnit: "week",
      },
    });
    const snapshot = await (await page.request.get(endpoint)).json();
    for (const [index, key, value] of [
      [0, "A02", 0],
      [0, "G05", false],
      [1, "G05", false],
      [2, "G05", true],
    ])
      await mutate({
        type: "answer.put",
        apartmentId: properties[index].id,
        criterionId: snapshot.criteria.find((c) => c.key === key).id,
        checklistRevision: snapshot.collection.checklistRevision,
        payload: { state: "answered", value },
      });
    const parameters = new URLSearchParams({
      collection: collection.id,
      page: "compare",
      selected: properties.map((p) => p.id).join(","),
      pair: properties
        .slice(0, 2)
        .map((p) => p.id)
        .join(","),
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const width of [320, 390, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/?${parameters}`);
      await expect(
        page.getByRole("heading", { name: "Compare", exact: true }),
      ).toBeVisible();
      const mobile = width < 700;
      const comparison = page.locator(
        mobile ? ".mobile-compare" : ".desktop-compare",
      );
      const labels = comparison.locator(mobile ? "h3" : 'th[scope="row"]');
      for (const label of [
        "Monthly housing",
        "Upfront personal cash",
        "24-month expense",
        "Refundable deposits",
        "Unpriced commute",
      ])
        await expect(labels.filter({ hasText: label })).toHaveCount(0);
      await expect(
        labels.filter({ hasText: /^Advertised floor area$/ }),
      ).toBeVisible();
      await expect(labels.filter({ hasText: /^Actual layout$/ })).toHaveCount(
        0,
      );
      const parking = labels.filter({ hasText: /^Bicycle parking available$/ });
      if (mobile) {
        await expect(parking).toHaveCount(0);
        const picker = page
          .locator(".pair-picker")
          .getByRole("combobox")
          .nth(1);
        await picker.click();
        await page
          .getByRole("option", { name: properties[2].name, exact: true })
          .click();
        await expect(parking).toBeVisible();
      } else await expect(parking).toBeVisible();
      const section = page.getByRole("combobox", {
        name: "Section",
        exact: true,
      });
      await section.click();
      await page
        .getByRole("option", { name: "Neighborhood & moving", exact: true })
        .click();
      await expect(parking).toBeVisible();
      await page
        .getByRole("checkbox", { name: properties[2].name, exact: true })
        .uncheck();
      await expect(parking).toHaveCount(0);
      await expect(comparison.locator(".empty-filter")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await page.screenshot({
        path: testInfo.outputPath(`comparison-empty-${width}.png`),
      });
    }
    expect(errors).toEqual([]);
  } finally {
    process.env.LOCAL_AUTH = "true";
    const { pool } = await import("../../lib/db.mjs");
    await pool().query("DELETE FROM collections WHERE id=$1", [collection.id]);
  }
});
