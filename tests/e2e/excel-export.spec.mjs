import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readSheet } from "read-excel-file/node";
import { offlineBoundary } from "./offline-boundary.mjs";

async function login(page, url = "http://127.0.0.1:3001") {
  await page
    .context()
    .addCookies([{ name: "house-persona", value: "owner", url }]);
  await page.request.post(`${url}/api/profile`, { data: { locale: "en" } });
  await page.goto(`${url}/?page=apartments`);
  await expect(page.locator(".property-list")).toBeVisible();
}
async function fixtures(page, count) {
  const session = await (await page.request.get("/api/session")).json();
  const cid = session.collections[0].id;
  const snapshot = await (
    await page.request.get(`/api/collections/${cid}`)
  ).json();
  const apartments = [];
  for (let i = 0; i < count; i++) {
    const response = await page.request.post(
      `/api/collections/${cid}/mutations`,
      {
        data: {
          id: randomUUID(),
          type: "apartment.put",
          targetId: randomUUID(),
          expectedRevision: 0,
          payload: {
            name: `Excel ${randomUUID().slice(0, 8)} 東京 Tiếng Việt ${i + 1}`,
            rentStart: "2026-11-01",
            ...(i === 0 ? { expense24: 1200000 } : {}),
          },
        },
      },
    );
    expect(response.ok()).toBeTruthy();
    apartments.push((await response.json()).record);
  }
  for (const [key, value] of [
    ["A02", 0],
    ["H01", 45000],
    ["H02", 5000],
  ]) {
    const response = await page.request.post(
      `/api/collections/${cid}/mutations`,
      {
        data: {
          id: randomUUID(),
          type: "answer.put",
          targetId: randomUUID(),
          expectedRevision: 0,
          checklistRevision: snapshot.collection.checklistRevision,
          apartmentId: apartments[0].id,
          criterionId: snapshot.criteria.find((c) => c.key === key).id,
          payload: {
            state: "answered",
            value,
            ...(key === "A02" ? { notes: "Recorded 東京 Tiếng Việt" } : {}),
          },
        },
      },
    );
    expect(response.ok()).toBeTruthy();
  }
  return { cid, snapshot, apartments };
}
async function cleanup(page, data) {
  if (!data) return;
  const snapshot = await (
    await page.request.get(`/api/collections/${data.cid}`)
  ).json();
  for (const apt of data.apartments) {
    const current = snapshot.apartments.find((a) => a.id === apt.id);
    const response = await page.request.post(
      `/api/collections/${data.cid}/mutations`,
      {
        data: {
          id: randomUUID(),
          type: "apartment.put",
          targetId: apt.id,
          expectedRevision: current.revision,
          payload: { archived: true },
        },
      },
    );
    expect(response.ok()).toBeTruthy();
  }
}
async function compare(page, apartments) {
  await page.reload();
  for (const apt of apartments)
    await page
      .getByRole("checkbox", { name: `Select for comparison: ${apt.name}` })
      .check();
  await page
    .locator(".sidebar:visible,.mobile-nav:visible")
    .getByRole("link", { name: "Compare", exact: false })
    .first()
    .click();
}
async function downloadExcel(page, testInfo, name) {
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Excel", exact: true }).click();
  const download = await waiting;
  expect(download.suggestedFilename()).toMatch(
    /^house-checklist-comparison-.*_\d{2}-\d{2}-\d{2}-\d{3}\.xlsx$/,
  );
  const path = testInfo.outputPath(`${name}.xlsx`);
  await download.saveAs(path);
  return readSheet(path, { trim: false });
}

test("comparison Excel downloads all selected properties with filters, responsive controls and viewer access", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  await login(page);
  await page
    .locator(".sidebar:visible,.mobile-nav:visible")
    .getByRole("link", { name: "Compare", exact: false })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Export Excel", exact: true }),
  ).toBeDisabled();
  const data = await fixtures(page, 4);
  try {
    await page.goto(`/?page=apartments&collection=${data.cid}`);
    await compare(page, data.apartments);
    const section = page.getByRole("combobox", {
      name: "Section",
      exact: true,
    });
    await section.click();
    const label = data.snapshot.sections.find((s) => s.key === "A").labels.en;
    await page.getByRole("option", { name: label, exact: true }).click();
    for (const width of [320, 390, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const button = page.getByRole("button", {
        name: "Export Excel",
        exact: true,
      });
      await expect(button).toBeVisible();
      const bounds = await button.boundingBox();
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await page.screenshot({
        path: testInfo.outputPath(`compare-${width}.png`),
      });
    }
    const rows = await downloadExcel(page, testInfo, "comparison-filtered");
    expect(
      rows.find(([label]) => label === "Shared checklist").slice(1),
    ).toEqual(data.apartments.map((a) => a.name));
    expect(
      rows.find(([label]) => label === "Monthly housing").slice(1),
    ).toEqual([50000, "Unknown", "Unknown", "Unknown"]);
    expect(rows.find(([label]) => label === "24-month expense")[1]).toBe(
      1200000,
    );
    expect(rows.find(([label]) => label?.startsWith("A02 ·"))[1]).toBe(0);
    expect(rows.some(([label]) => label?.startsWith("H01 ·"))).toBe(false);
    expect(rows.flat()).toContain("Recorded 東京 Tiếng Việt");
    await section.click();
    await page
      .getByRole("option", { name: "All sections", exact: true })
      .click();
    await page.context().addCookies([
      {
        name: "house-persona",
        value: "viewer",
        url: "http://127.0.0.1:3001",
      },
    ]);
    await page.reload();
    await expect(page.locator(".view-only")).toBeVisible();
    const viewed = await downloadExcel(page, testInfo, "viewer-comparison");
    expect(viewed.find(([label]) => label?.startsWith("H01 ·"))[1]).toBe(45000);
  } finally {
    await page
      .context()
      .addCookies([
        { name: "house-persona", value: "owner", url: "http://127.0.0.1:3001" },
      ]);
    await cleanup(page, data);
  }
});

test("first Excel export works offline and includes locally saved edits", async ({
  page,
  browserName,
}, testInfo) => {
  test.setTimeout(90000);
  const boundary = await offlineBoundary(browserName, page.context());
  let data;
  try {
    await login(page, boundary.url);
    data = await fixtures(page, 2);
    await compare(page, data.apartments);
    await page
      .getByRole("link", { name: data.apartments[0].name, exact: true })
      .last()
      .click();
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller)
        await new Promise((resolve) =>
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            resolve,
            { once: true },
          ),
        );
      if (registration.installing)
        await new Promise((resolve) =>
          registration.installing.addEventListener("statechange", function () {
            if (this.state === "activated") resolve();
          }),
        );
    });
    await boundary.offline();
    await page.getByTestId("check-A02").getByRole("spinbutton").fill("29");
    await expect(page.locator(".save-status")).not.toHaveText("Saved");
    await page
      .locator(".sidebar:visible,.mobile-nav:visible")
      .getByRole("link", { name: "Compare", exact: false })
      .first()
      .click();
    const rows = await downloadExcel(page, testInfo, "offline-comparison");
    expect(rows.find(([label]) => label?.startsWith("A02 ·"))[1]).toBe(29);
    expect(rows.flat()).toContain(
      "Includes locally saved changes awaiting synchronization.",
    );
    // WebKit's stopped proxy blocks requests while navigator.onLine stays true.
    if (browserName !== "webkit")
      expect(rows.flat()).toContain("Exported from the offline copy.");
  } finally {
    await boundary.online();
    await cleanup(page, data);
    await boundary.close();
  }
});
