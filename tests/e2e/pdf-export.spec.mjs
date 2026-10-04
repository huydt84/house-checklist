import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { offlineBoundary } from "./offline-boundary.mjs";

async function login(
  page,
  persona = "owner",
  url = "http://127.0.0.1:3001/?page=apartments",
) {
  await page
    .context()
    .addCookies([{ name: "house-persona", value: persona, url }]);
  const destination = new URL(url);
  if (
    !destination.searchParams.has("collection") &&
    !destination.searchParams.has("page")
  )
    destination.searchParams.set("page", "apartments");
  await page.goto(destination.href);
  await expect(page.locator(".property-list")).toBeVisible();
}
async function downloadReport(page, testInfo, name) {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.pdf$/);
  const path = testInfo.outputPath(`${name}.pdf`);
  await file.saveAs(path);
  const bytes = await readFile(path);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  const loading = getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: false,
  });
  const doc = await loading.promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const p = await doc.getPage(n),
      content = await p.getTextContent();
    pages.push(content.items.map((i) => i.str || "").join(" "));
  }
  const first = await doc.getPage(1),
    view = first.view;
  await loading.destroy();
  return { text: pages.join("\n"), pages, view };
}
async function fixtures(page, count) {
  const session = await (await page.request.get("/api/session")).json(),
    cid = session.collections[0].id;
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
            name: `PDF ${randomUUID().slice(0, 8)} 東京 Tiếng Việt ${i + 1}`,
            rentStart: "2026-11-01",
            ...(count === 1
              ? {
                  disadvantages:
                    "Recorded detail 東京 Tiếng Việt. ".repeat(120) +
                    "Final recorded detail.",
                }
              : i === 0
                ? { expense24: 1200000 }
                : {}),
          },
        },
      },
    );
    expect(response.ok()).toBeTruthy();
    apartments.push((await response.json()).record);
  }
  if (count === 4)
    for (const [key, value] of [
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
            payload: { state: "answered", value },
          },
        },
      );
      expect(response.ok()).toBeTruthy();
    }
  return { cid, snapshot, apartments };
}
async function removeFixtures(page, { cid, apartments }) {
  for (const apt of apartments) {
    const s = await (await page.request.get(`/api/collections/${cid}`)).json();
    const current = s.apartments.find((a) => a.id === apt.id);
    await page.request.post(`/api/collections/${cid}/mutations`, {
      data: {
        id: randomUUID(),
        type: "apartment.put",
        targetId: apt.id,
        expectedRevision: current.revision,
        payload: { archived: true },
      },
    });
  }
}
async function compareNav(page) {
  await page
    .locator(".sidebar:visible,.mobile-nav:visible")
    .getByRole("link", { name: "Compare", exact: false })
    .first()
    .click();
}

test("property PDF downloads offline with local data, mixed-language text and no unknown fields", async ({
  page,
  browserName,
}, testInfo) => {
  test.setTimeout(90000);
  const boundary = await offlineBoundary(browserName, page.context());
  let data;
  try {
    await login(page, "owner", boundary.url);
    data = await fixtures(page, 1);
    const apt = data.apartments[0];
    await page.reload();
    await page
      .getByRole("link", { name: apt.name, exact: true })
      .last()
      .click();
    await page.getByTestId("check-A02").getByRole("spinbutton").fill("0");
    await expect(page.locator(".save-status")).toHaveText("Saved");
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      if (registration.installing || registration.waiting)
        await new Promise((resolve) =>
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            resolve,
            { once: true },
          ),
        );
    });
    // No PDF has been exported in this context: both renderer and fonts must be precached.
    await boundary.offline();
    await page.getByTestId("check-A02").getByRole("spinbutton").fill("29");
    await expect(page.locator(".save-status")).not.toHaveText("Saved");
    const report = await downloadReport(page, testInfo, "property-offline");
    expect(report.text).toContain("東京 Tiếng Việt");
    expect(report.text).toContain("29");
    expect(report.text).toContain("Final recorded detail.");
    expect(report.text).toContain("awaiting synchronization");
    expect(report.text).not.toContain("Unknown");
    expect(report.text).not.toContain("Not checked");
    expect(report.text).not.toContain("Agent name");
    expect(report.text).not.toContain("24-month expense");
    expect(report.view[3]).toBeGreaterThan(report.view[2]);
  } finally {
    await boundary.online();
    if (data) await removeFixtures(page, data);
    await boundary.close();
  }
});

test("comparison PDF downloads all four selected properties, honors filters and permits viewers", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  await login(page);
  const data = await fixtures(page, 4);
  try {
    await page.reload();
    for (const apt of data.apartments)
      await page
        .getByRole("checkbox", { name: `Select for comparison: ${apt.name}` })
        .check();
    await compareNav(page);
    const section = page.getByRole("combobox", {
      name: "Section",
      exact: true,
    });
    await section.click();
    const label = data.snapshot.sections.find((s) => s.key === "A").labels.en;
    await page.getByRole("option", { name: label, exact: true }).click();
    const report = await downloadReport(page, testInfo, "comparison-four");
    for (const apt of data.apartments) expect(report.text).toContain(apt.name);
    expect(report.text).toContain("Applied checklist filters");
    expect(report.text).toContain("50,000");
    expect(report.text).toContain("1,200,000");
    expect(report.text).toContain("A02");
    expect(report.text).not.toContain("C01");
    expect(report.text).toContain("Unknown");
    expect(report.text).toContain("Not checked");
    expect(report.view[2]).toBeGreaterThan(report.view[3]);
    // Full reports exercise repeated table headers and pagination.
    await section.click();
    await page
      .getByRole("option", { name: "All sections", exact: true })
      .click();
    const full = await downloadReport(page, testInfo, "comparison-full");
    expect(full.pages.length).toBeGreaterThan(1);
    for (const apt of data.apartments)
      expect(full.pages.at(-1)).toContain(apt.name);
    await page.context().addCookies([
      {
        name: "house-persona",
        value: "viewer",
        url: "http://127.0.0.1:3001",
      },
    ]);
    await page.reload();
    await page
      .getByRole("link", { name: data.apartments[0].name, exact: true })
      .last()
      .click();
    await expect(
      page.getByRole("button", { name: "Edit", exact: true }),
    ).toHaveCount(0);
    expect(
      (await downloadReport(page, testInfo, "viewer-property")).text,
    ).toContain(data.apartments[0].name);
  } finally {
    await page
      .context()
      .addCookies([
        { name: "house-persona", value: "owner", url: "http://127.0.0.1:3001" },
      ]);
    await removeFixtures(page, data);
  }
});

test.describe("PDF generation recovery", () => {
  test.use({ serviceWorkers: "block" });
  test("failed font load reports an error and Export PDF can be retried", async ({
    page,
  }, testInfo) => {
    await login(page);
    await compareNav(page);
    await expect(
      page.getByRole("button", { name: "Export PDF", exact: true }),
    ).toBeDisabled();
    await page
      .locator(".sidebar:visible,.mobile-nav:visible")
      .getByRole("link", { name: "Apartments", exact: false })
      .first()
      .click();
    const data = await fixtures(page, 1);
    try {
      await page.reload();
      await page
        .getByRole("link", { name: data.apartments[0].name, exact: true })
        .last()
        .click();
      await page.route("**/fonts/pdf/*.ttf", (route) => route.abort());
      await page
        .getByRole("button", { name: "Export PDF", exact: true })
        .click();
      await expect(
        page.locator(".pdf-export").getByRole("alert"),
      ).toContainText("PDF could not be generated");
      await expect(
        page.getByRole("button", { name: "Export PDF", exact: true }),
      ).toBeEnabled();
      await page.unroute("**/fonts/pdf/*.ttf");
      expect(
        (await downloadReport(page, testInfo, "retry-property")).text,
      ).toContain(data.apartments[0].name);
      await expect(page.locator(".pdf-export").getByRole("alert")).toHaveCount(
        0,
      );
    } finally {
      await removeFixtures(page, data);
    }
  });
});
