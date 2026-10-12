import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("comparison displays plain building years, calendar dates and monthly amounts without repeated periods", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  await page
    .context()
    .addCookies([
      { name: "house-persona", value: "owner", url: "http://127.0.0.1:3001" },
    ]);
  await page.request.post("/api/profile", { data: { locale: "vi" } });
  const response = await page.request.post("/api/collections", {
    data: { name: `Checklist format ${randomUUID()}` },
  });
  expect(response.ok()).toBeTruthy();
  const collection = await response.json();
  const endpoint = `/api/collections/${collection.id}`;
  try {
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
    const apartments = [];
    for (const name of ["Căn hộ A", "Căn hộ B"])
      apartments.push(
        await mutate({ type: "apartment.put", payload: { name } }),
      );
    const snapshot = await (await page.request.get(endpoint)).json();
    for (const [index, key, value] of [
      [0, "A05", 1992],
      [1, "A05", 1993],
      [0, "A06", "2026-10-19"],
      [1, "A06", "2026-11"],
      [0, "H01", 42000],
      [1, "H01", 43000],
      [0, "H02", 3000],
      [0, "F05", 0],
      [0, "G06", 0],
    ])
      await mutate({
        type: "answer.put",
        apartmentId: apartments[index].id,
        criterionId: snapshot.criteria.find((c) => c.key === key).id,
        checklistRevision: snapshot.collection.checklistRevision,
        payload: { state: "answered", value },
      });
    const parameters = new URLSearchParams({
      collection: collection.id,
      page: "compare",
      selected: apartments.map((a) => a.id).join(","),
      pair: apartments.map((a) => a.id).join(","),
    });
    for (const width of [320, 390, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/?${parameters}`);
      const mobile = width < 700;
      const comparison = page.locator(
        mobile ? ".mobile-compare" : ".desktop-compare",
      );
      const row = (label) =>
        comparison
          .locator(mobile ? "article" : "tr")
          .filter({ has: page.getByText(label, { exact: true }) });
      await expect(row("Năm xây dựng").locator(".answer-value")).toHaveText([
        "1992",
        "1993",
      ]);
      await expect(
        row("Ngày có thể chuyển vào").locator(".answer-value"),
      ).toHaveText(["19/10/2026", "11/2026"]);
      await expect(row("Tiền thuê nhà").locator(".answer-value")).toHaveText([
        "42.000 ¥",
        "43.000 ¥",
      ]);
      await expect(
        row("Phí internet định kỳ").locator(".answer-value").first(),
      ).toHaveText("0 ¥");
      await expect(
        row("Phí đỗ xe đạp hằng tháng").locator(".answer-value").first(),
      ).toHaveText("0 ¥");
      await expect(comparison.locator(".answer-value")).not.toContainText([
        "/Tháng",
      ]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await row("Năm xây dựng").scrollIntoViewIfNeeded();
      if (mobile) {
        for (const [label, kind] of [
          ["Năm xây dựng", "year"],
          ["Ngày có thể chuyển vào", "date"],
        ]) {
          await row(label).evaluate((element) =>
            element.scrollIntoView({ block: "center", behavior: "instant" }),
          );
          await row(label).screenshot({
            path: testInfo.outputPath(`${kind}-${width}.png`),
          });
        }
      }
      await page.screenshot({
        path: testInfo.outputPath(`checklist-format-${width}.png`),
      });
    }
  } finally {
    await page.request.post("/api/profile", { data: { locale: "en" } });
    process.env.LOCAL_AUTH = "true";
    const { pool } = await import("../../lib/db.mjs");
    await pool().query("DELETE FROM collections WHERE id=$1", [collection.id]);
  }
});
