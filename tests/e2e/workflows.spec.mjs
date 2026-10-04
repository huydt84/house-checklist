import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { offlineBoundary } from "./offline-boundary.mjs";
const owner = "10000000-0000-4000-8000-000000000001";
async function login(page) {
  await page
    .context()
    .addCookies([
      { name: "house-persona", value: "owner", url: "http://127.0.0.1:3001" },
    ]);
  await page.request.post("/api/profile", { data: { locale: "en" } });
  await page.goto("/?page=apartments");
  await expect(
    page.getByRole("heading", { name: "Apartments", exact: true }),
  ).toBeVisible();
}
async function selectTab(page, name) {
  await page.getByRole("tab", { name, exact: false }).click();
}
async function nav(page, name) {
  const locator = page
    .locator(".sidebar:visible,.mobile-nav:visible")
    .getByRole("link", { name, exact: false });
  await locator.first().click();
}
async function createApartment(page, name) {
  await page
    .getByRole("button", { name: "Add apartment", exact: true })
    .click();
  await page.getByRole("dialog").getByLabel("Name", { exact: true }).fill(name);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}
test("quick creation, canonical values, cost fixture and responsive comparison work", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  const name = `Browser ${Date.now()}`;
  await createApartment(page, name);
  const area = page.getByTestId("check-A02");
  await area.getByRole("spinbutton").fill("29");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  const session = await (await page.request.get("/api/session")).json();
  const cid = session.collections[0].id;
  const snapshot = await (
    await page.request.get(`/api/collections/${cid}`)
  ).json();
  const apartment = snapshot.apartments.find((a) => a.name === name);
  for (const [key, value] of [
    ["H01", 45000],
    ["H02", 5000],
  ]) {
    const charge = await page.request.post(
      `/api/collections/${cid}/mutations`,
      {
        data: {
          id: randomUUID(),
          targetId: randomUUID(),
          type: "answer.put",
          expectedRevision: 0,
          checklistRevision: snapshot.collection.checklistRevision,
          apartmentId: apartment.id,
          criterionId: snapshot.criteria.find((c) => c.key === key).id,
          payload: { state: "answered", value },
        },
      },
    );
    expect(charge.ok()).toBeTruthy();
  }
  const layout = await page.request.post(`/api/collections/${cid}/mutations`, {
    data: {
      id: randomUUID(),
      targetId: randomUUID(),
      type: "answer.put",
      expectedRevision: 0,
      checklistRevision: snapshot.collection.checklistRevision,
      apartmentId: apartment.id,
      criterionId: snapshot.criteria.find((c) => c.key === "A03").id,
      payload: { state: "answered", value: "other", other: "Studio" },
    },
  });
  expect(layout.ok()).toBeTruthy();
  await page.reload();
  await nav(page, "Apartments");
  await expect(
    page
      .getByRole("article")
      .filter({ has: page.getByRole("link", { name, exact: true }) }),
  ).toContainText("50,000");
  await expect(
    page
      .getByRole("article")
      .filter({ has: page.getByRole("link", { name, exact: true }) }),
  ).toContainText("Other · Studio");
  await page.getByRole("link", { name, exact: true }).last().click();
  await selectTab(page, "Viewing checklist");
  await expect(
    page.getByTestId("check-A02").getByRole("spinbutton"),
  ).toHaveValue("29");
  await nav(page, "Apartments");
  await page
    .getByRole("link", { name: "Kiyosumi Garden · 402", exact: true })
    .last()
    .click();
  await selectTab(page, "Costs");
  await expect(
    page.locator(".cost-summary > div").filter({ hasText: "24-month expense" }),
  ).toContainText("Enter your 24-month estimate below");
  await expect(page.locator(".cost-summary")).toContainText("270,000");
  await nav(page, "Apartments");
  await page
    .getByRole("checkbox", {
      name: "Select for comparison: Kiyosumi Garden · 402",
    })
    .check();
  await page
    .getByRole("checkbox", {
      name: "Select for comparison: Morishita Residence · 601",
    })
    .check();
  await nav(page, "Compare");
  await expect(
    page.getByRole("heading", { name: "Compare", exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).toContainText("Kiyosumi Garden · 402");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
test("move-in date picker preserves previous text and saves and clears dates across screen sizes", async ({
  page,
}, testInfo) => {
  await login(page);
  const name = `Browser ${Date.now()}`;
  await createApartment(page, name);
  await expect(page.locator(".save-status")).toHaveText("Saved");
  const session = await (await page.request.get("/api/session")).json();
  const cid = session.collections[0].id;
  const snapshot = await (
    await page.request.get(`/api/collections/${cid}`)
  ).json();
  const apartment = snapshot.apartments.find((a) => a.name === name);
  const criterion = snapshot.criteria.find((c) => c.key === "A06");
  const legacy = "Available after the current tenant leaves";
  const response = await page.request.post(
    `/api/collections/${cid}/mutations`,
    {
      data: {
        id: randomUUID(),
        targetId: randomUUID(),
        type: "answer.put",
        expectedRevision: 0,
        checklistRevision: snapshot.collection.checklistRevision,
        apartmentId: apartment.id,
        criterionId: criterion.id,
        payload: {
          state: "answered",
          value: legacy,
          notes: "Agent confirmation pending",
        },
      },
    },
  );
  expect(response.ok()).toBeTruthy();
  await page.reload();
  await selectTab(page, "Viewing checklist");
  const card = page.getByTestId("check-A06");
  const input = card.getByLabel("Answer", { exact: true });
  await expect(input).toHaveAttribute("type", "date");
  await expect(card).toContainText(legacy);
  for (const width of [320, 390, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await input.fill("2026-11-15");
    await card.getByRole("heading").click();
    await expect(page.locator(".save-status")).toHaveText("Saved");
    await page.reload();
    await expect(input).toHaveValue("2026-11-15");
    await expect(card).toHaveAttribute("data-answer-state", "answered");
    await card.locator(".evidence summary").click();
    await expect(card.getByLabel("Notes", { exact: true })).toHaveValue(
      `Agent confirmation pending\n\n${legacy}`,
    );
    await card.locator(".evidence summary").click();
    await input.scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: testInfo.outputPath(`move-in-date-${width}.png`),
    });
    await input.fill("");
    await expect(page.locator(".save-status")).toHaveText("Saved");
    await page.reload();
    await expect(input).toHaveValue("");
    await expect(card).toHaveAttribute("data-answer-state", "not_checked");
  }
  // Reload can render a retained local draft before startup synchronization
  // finishes. Wait for server persistence before inspecting the saved answer.
  await expect
    .poll(async () => {
      const data = await (
        await page.request.get(`/api/collections/${cid}`)
      ).json();
      return data.answers.find(
        (a) => a.apartmentId === apartment.id && a.criterionId === criterion.id,
      )?.value;
    })
    .toBeNull();
  const saved = await (
    await page.request.get(`/api/collections/${cid}`)
  ).json();
  const answer = saved.answers.find(
    (a) => a.apartmentId === apartment.id && a.criterionId === criterion.id,
  );
  expect(answer.value).toBeNull();
  expect(answer.notes).toBe(`Agent confirmation pending\n\n${legacy}`);
});
test("checklist input retains its value and filled surface after clicking inside the card", async ({
  page,
}, testInfo) => {
  await login(page);
  await createApartment(page, `Browser ${Date.now()}`);
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await selectTab(page, "Viewing checklist");
  const year = page.getByTestId("check-A05");
  const input = year.getByRole("spinbutton", {
    name: "Building year",
    exact: true,
  });
  await input.fill("2008");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  for (const width of [320, 390, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await input.fill("");
    const emptySurface = await input.evaluate(
      (e) => getComputedStyle(e).backgroundColor,
    );
    await input.pressSequentially("1986");
    await year
      .getByRole("heading", { name: "Building year", exact: true })
      .click();
    await expect(input).not.toBeFocused();
    await expect(input).toHaveValue("1986");
    await expect(page.locator(".save-status")).toHaveText("Saved");
    await expect(input).toHaveAccessibleDescription("Filled");
    expect(
      await input.evaluate((e) => getComputedStyle(e).backgroundColor),
    ).not.toBe(emptySurface);
    await input.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath(`input-blur-${width}.png`),
    });
    await page.reload();
    await expect(input).toHaveValue("1986");
  }
});
test("checklist states stay visible and optional cost records can be deleted without changing totals", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await login(page);
  const name = `Browser ${Date.now()}`;
  await createApartment(page, name);
  await expect(page.locator(".save-status")).toHaveText("Saved");
  const session = await (await page.request.get("/api/session")).json();
  const cid = session.collections[0].id;
  const snapshot = await (
    await page.request.get(`/api/collections/${cid}`)
  ).json();
  const apartment = snapshot.apartments.find((a) => a.name === name);
  const legacy = await page.request.post(`/api/collections/${cid}/mutations`, {
    data: {
      id: randomUUID(),
      targetId: randomUUID(),
      type: "record.put",
      expectedRevision: 0,
      apartmentId: apartment.id,
      payload: {
        kind: "benefit",
        name: "Legacy allowance",
        amount: 10000,
        frequencyUnit: "monthly",
      },
    },
  });
  expect(legacy.ok()).toBeTruthy();
  await page.reload();
  await selectTab(page, "Costs");
  await expect(page.getByText("Legacy allowance", { exact: true })).toHaveCount(
    0,
  );
  const preserved = await (
    await page.request.get(`/api/collections/${cid}`)
  ).json();
  expect(
    preserved.records.some(
      (r) =>
        r.kind === "benefit" &&
        r.name === "Legacy allowance" &&
        r.amount === 10000,
    ),
  ).toBeTruthy();
  await selectTab(page, "Overview");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const room = page
    .getByRole("dialog")
    .getByLabel("Room number", { exact: true });
  await expect(room).toHaveAccessibleDescription("Empty");
  await room.fill("302");
  await expect(room).toHaveAccessibleDescription("Filled");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await selectTab(page, "Viewing checklist");
  const area = page.getByTestId("check-A02");
  await expect(
    area.locator(".check-heading .chip").filter({ hasText: "Not checked" }),
  ).toBeVisible();
  await area.getByRole("spinbutton").fill("29");
  await expect(
    area.locator(".check-heading .chip").filter({ hasText: "Checked" }),
  ).toBeVisible();
  await expect(page.locator(".section-intro")).toContainText("1/");
  await area
    .getByRole("checkbox", { name: "Not applicable", exact: true })
    .check();
  await expect(
    area.locator(".check-heading .chip").filter({ hasText: "Not applicable" }),
  ).toBeVisible();
  await area
    .getByRole("checkbox", { name: "Not applicable", exact: true })
    .uncheck();
  await expect(
    area.locator(".check-heading .chip").filter({ hasText: "Not checked" }),
  ).toBeVisible();
  const year = page.getByTestId("check-A05");
  await expect(page.getByTestId("check-A01")).toHaveCount(0);
  await expect(
    year.getByRole("heading", { name: "Building year", exact: true }),
  ).toBeVisible();
  await expect(year.getByLabel("Floor", { exact: true })).toHaveCount(0);
  await expect(year.getByLabel("Construction", { exact: true })).toHaveCount(0);
  await year
    .getByRole("spinbutton", { name: "Building year", exact: true })
    .fill("2008");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(
    page.getByTestId("check-A05").getByRole("spinbutton"),
  ).toHaveValue("2008");
  await selectTab(page, "Overview");
  await expect(page.getByTestId("check-A01")).toHaveCount(0);
  await expect(
    page.getByTestId("check-A05").getByRole("spinbutton"),
  ).toHaveValue("2008");
  await selectTab(page, "Costs");
  await expect(
    page.getByRole("button", { name: "Add a benefit", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".cost-summary")).not.toContainText(
    "After confirmed benefits",
  );
  await page.getByTestId("check-H01").getByRole("spinbutton").fill("45000");
  await page.getByTestId("check-H02").getByRole("spinbutton").fill("5000");
  await expect(
    page
      .locator(".cost-summary > div")
      .filter({ hasText: "Monthly housing" })
      .getByText("¥50,000", { exact: true }),
  ).toBeVisible();
  const estimate = page.getByLabel("24-month expense estimate (JPY)", {
    exact: true,
  });
  await expect(estimate).toHaveAccessibleDescription("Empty");
  const estimateMarker = estimate
    .locator("xpath=ancestor::label")
    .locator(".field-status");
  expect(
    await estimateMarker.evaluate((e) => e.getBoundingClientRect().height),
  ).toBeLessThan(44);
  const emptySurface = await estimate.evaluate(
    (e) => getComputedStyle(e).backgroundColor,
  );
  await estimate.fill("0");
  await expect(estimate).toHaveAccessibleDescription("Filled");
  expect(
    await estimate.evaluate((e) => getComputedStyle(e).backgroundColor),
  ).not.toBe(emptySurface);
  await estimate.fill("");
  await expect(estimate).toHaveAccessibleDescription("Empty");
  await estimate.fill("1150000");
  await expect(
    estimate.locator("xpath=ancestor::label").locator(".field-status"),
  ).toBeVisible();
  await estimate
    .locator("xpath=ancestor::form")
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(
    page.locator(".cost-summary > div").filter({ hasText: "24-month expense" }),
  ).toContainText("¥1,150,000");
  await page.getByRole("button", { name: "Add a charge", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill("Cleaning charge");
  await dialog.getByLabel("Amount (JPY)", { exact: true }).fill("12000");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  const row = page
    .locator(".record-row")
    .filter({ hasText: "Cleaning charge" });
  await expect(row).toBeVisible();
  await expect(row.locator(".cost-record-amount .field-status")).toHaveText(
    "Filled",
  );
  await expect(
    page.locator(".cost-summary > div").filter({ hasText: "24-month expense" }),
  ).toContainText("¥1,150,000");
  await row
    .getByRole("button", { name: "Delete: Cleaning charge", exact: true })
    .click();
  await expect(row).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(row).toBeVisible();
  await row
    .getByRole("button", { name: "Delete: Cleaning charge", exact: true })
    .click();
  await expect(row).toHaveCount(0);
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await selectTab(page, "Costs");
  await expect(
    page.locator(".record-row").filter({ hasText: "Cleaning charge" }),
  ).toHaveCount(0);
  await expect(
    page.getByTestId("check-H01").getByRole("spinbutton"),
  ).toHaveValue("45000");
  await expect(
    page.getByLabel("24-month expense estimate (JPY)", { exact: true }),
  ).toHaveValue("1150000");
  await expect(
    page.locator(".cost-summary > div").filter({ hasText: "24-month expense" }),
  ).toContainText("¥1,150,000");
  await selectTab(page, "Travel");
  const minutes = page.getByLabel("Return duration (minutes)", { exact: true });
  await expect(minutes).toHaveAccessibleDescription("Empty");
  await minutes.fill("0");
  await expect(minutes).toHaveAccessibleDescription("Filled");
  await minutes.fill("");
  await expect(minutes).toHaveAccessibleDescription("Empty");
  const notes = page
    .locator(".panel form")
    .getByLabel("Notes", { exact: true });
  await notes.fill("   ");
  await expect(notes).toHaveAccessibleDescription("Empty");
  await notes.fill("Return by train");
  await expect(notes).toHaveAccessibleDescription("Filled");
  page.once("dialog", (dialog) => dialog.accept());
  await selectTab(page, "Photos & files");
  await page
    .getByRole("button", { name: "Add an external link", exact: true })
    .click();
  const linkUrl = page.getByRole("dialog").getByLabel("Link", { exact: true });
  await expect(linkUrl).toHaveAccessibleDescription("Empty");
  await linkUrl.fill("https://example.com/listing");
  await expect(linkUrl).toHaveAccessibleDescription("Filled");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
});
test("suitability alone turns an empty checklist green immediately and persists across widths", async ({
  page,
}, testInfo) => {
  await login(page);
  await createApartment(page, `Browser ${Date.now()}`);
  await expect(page.locator(".save-status")).toHaveText("Saved");
  const session = await (await page.request.get("/api/session")).json();
  const snapshot = await (
    await page.request.get(`/api/collections/${session.collections[0].id}`)
  ).json();
  await selectTab(page, "Viewing checklist");
  const url = new URL(page.url());
  url.searchParams.set(
    "viewSection",
    snapshot.sections.find((s) => s.key === "F").id,
  );
  await page.goto(url.href);
  const outlets = page.getByTestId("check-F02");
  const acknowledgment = (suitability) =>
    page.waitForResponse((response) => {
      if (
        !response.url().endsWith("/mutations") ||
        response.request().method() !== "POST"
      )
        return false;
      const command = response.request().postDataJSON();
      return (
        command.criterionId ===
          snapshot.criteria.find((c) => c.key === "F02").id &&
        command.payload.suitability === suitability
      );
    });
  for (const width of [320, 390, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const assessed = acknowledgment("meets");
    await outlets
      .getByRole("button", { name: "Meets my needs", exact: true })
      .click();
    await expect(outlets.locator(".assessment")).not.toContainText(
      "Review after preference changes",
    );
    await expect(outlets).toHaveAttribute("data-answer-state", "answered");
    await expect(outlets.locator(".check-heading .chip.teal")).toHaveText(
      "Checked",
    );
    expect((await assessed).status()).toBe(200);
    await expect(page.locator(".save-status")).toHaveText("Saved");
    await page.reload();
    await expect(outlets).toHaveAttribute("data-answer-state", "answered");
    await expect(
      outlets.getByRole("textbox", { name: "Answer", exact: true }),
    ).toHaveValue("");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await outlets.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath(`assessment-${width}.png`),
    });
    const reset = acknowledgment("unassessed");
    await outlets
      .getByRole("button", { name: "Unassessed", exact: true })
      .click();
    await expect(outlets).toHaveAttribute("data-answer-state", "not_checked");
    expect((await reset).status()).toBe(200);
    await expect(page.locator(".save-status")).toHaveText("Saved");
  }
});
test("D/E checklist entries keep assessments, visible notes and essential facts across reloads and widths", async ({
  page,
}, testInfo) => {
  await login(page);
  const name = `Browser ${Date.now()}`;
  await createApartment(page, name);
  await expect(page.locator(".save-status")).toHaveText("Saved");
  const session = await (await page.request.get("/api/session")).json();
  const cid = session.collections[0].id;
  const snapshot = await (
    await page.request.get(`/api/collections/${cid}`)
  ).json();
  const apartment = snapshot.apartments.find((a) => a.name === name);
  const legacy = await page.request.post(`/api/collections/${cid}/mutations`, {
    data: {
      id: randomUUID(),
      targetId: randomUUID(),
      type: "answer.put",
      expectedRevision: 0,
      checklistRevision: snapshot.collection.checklistRevision,
      apartmentId: apartment.id,
      criterionId: snapshot.criteria.find((c) => c.key === "D07").id,
      payload: {
        state: "answered",
        value: "Traffic heard at noon",
        notes: "Window open",
      },
    },
  });
  expect(legacy.ok()).toBeTruthy();
  await page.reload();
  await selectTab(page, "Viewing checklist");
  const openSection = async (key) => {
    const url = new URL(page.url());
    url.searchParams.set(
      "viewSection",
      snapshot.sections.find((s) => s.key === key).id,
    );
    await page.goto(url.href);
    await expect(page.getByTestId(`check-${key}01`)).toBeVisible();
  };
  await openSection("D");
  const noise = page.getByTestId("check-D07");
  await expect(noise.getByLabel("Notes", { exact: true })).toHaveValue(
    "Traffic heard at noon\n\nWindow open",
  );
  await noise
    .getByRole("button", { name: "Meets my needs", exact: true })
    .click();
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await noise
    .getByLabel("Notes", { exact: true })
    .fill("Traffic heard at noon; quieter with window closed");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(
    noise.getByRole("button", { name: "Meets my needs", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(noise.getByLabel("Notes", { exact: true })).toHaveValue(
    "Traffic heard at noon; quieter with window closed",
  );
  await expect(page.locator(".section-intro")).toContainText("1/9");
  await openSection("E");
  const burners = page.getByTestId("check-E02");
  await burners
    .getByRole("button", { name: "Meets my needs", exact: true })
    .click();
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(burners.getByRole("spinbutton")).toHaveValue("");
  await expect(
    burners.getByRole("button", { name: "Meets my needs", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await burners.getByRole("spinbutton").fill("2");
  await burners
    .getByLabel("Notes", { exact: true })
    .fill("Induction, both burners work");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(burners.getByRole("spinbutton")).toHaveValue("2");
  await expect(
    burners.getByRole("button", { name: "Meets my needs", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const fridge = page.getByTestId("check-E04");
  await expect(
    fridge.getByRole("checkbox", { name: "Available", exact: true }),
  ).not.toBeChecked();
  await expect(
    fridge.getByRole("checkbox", { name: "Not available", exact: true }),
  ).not.toBeChecked();
  await fridge
    .getByRole("checkbox", { name: "Available", exact: true })
    .check();
  await fridge
    .getByRole("checkbox", { name: "Not available", exact: true })
    .check();
  await expect(
    fridge.getByRole("checkbox", { name: "Available", exact: true }),
  ).not.toBeChecked();
  await fridge
    .getByRole("checkbox", { name: "Not available", exact: true })
    .uncheck();
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(
    fridge.getByRole("checkbox", { name: "Not available", exact: true }),
  ).not.toBeChecked();
  await fridge
    .getByRole("checkbox", { name: "Available", exact: true })
    .check();
  await fridge
    .getByRole("spinbutton", { name: "Width · m", exact: true })
    .fill("0.65");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(
    fridge.getByRole("spinbutton", { name: "Width · m", exact: true }),
  ).toHaveValue("0.65");
  await expect(
    fridge.getByRole("checkbox", { name: "Available", exact: true }),
  ).toBeChecked();
  const washer = page.getByTestId("check-E07");
  await washer
    .getByRole("checkbox", { name: "Not available", exact: true })
    .check();
  await washer.getByLabel("Notes", { exact: true }).fill("Bring own machine");
  const gas = page.getByTestId("check-E10");
  const chooseGas = async (name) => {
    await gas
      .getByRole("combobox", { name: "Gas provider type", exact: true })
      .click();
    await page.getByRole("option", { name, exact: true }).click();
  };
  await expect(gas.getByLabel("Other", { exact: true })).toHaveCount(0);
  await chooseGas("Other");
  await gas.getByLabel("Other", { exact: true }).fill("All electric");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(
    washer.getByRole("checkbox", { name: "Not available", exact: true }),
  ).toBeChecked();
  await expect(
    washer.getByRole("checkbox", { name: "Available", exact: true }),
  ).not.toBeChecked();
  await expect(washer.getByLabel("Notes", { exact: true })).toHaveValue(
    "Bring own machine",
  );
  await expect(gas.getByLabel("Other", { exact: true })).toHaveValue(
    "All electric",
  );
  for (const name of ["Toshi (city gas)", "Propane"]) {
    await chooseGas(name);
    await expect(gas.getByLabel("Other", { exact: true })).toHaveCount(0);
    await expect(page.locator(".save-status")).toHaveText("Saved");
    await page.reload();
    await expect(gas.getByRole("combobox")).toHaveText(name);
  }
  await chooseGas("Other");
  await expect(gas.getByLabel("Other", { exact: true })).toHaveValue(
    "All electric",
  );
  await burners
    .getByRole("button", { name: "Unassessed", exact: true })
    .click();
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.reload();
  await expect(burners.getByRole("spinbutton")).toHaveValue("2");
  await expect(page.locator(".section-intro")).toContainText("0/10");
  for (const width of [320, 390, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const key of ["D", "E"]) {
      await openSection(key);
      for (const item of await page.locator(".check-item").all()) {
        await expect(
          item
            .getByRole("group", { name: "Suitability assessment", exact: true })
            .getByRole("button"),
        ).toHaveCount(3);
        await expect(item.getByLabel("Notes", { exact: true })).toBeVisible();
        const appliance = ["check-E04", "check-E07"].includes(
          await item.getAttribute("data-testid"),
        );
        await expect(item.getByRole("checkbox")).toHaveCount(appliance ? 2 : 0);
        await expect(
          item.getByRole("button", { name: "Add question", exact: true }),
        ).toHaveCount(0);
        await expect(item.getByLabel("Source", { exact: true })).toHaveCount(0);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await page.getByTestId(`check-${key}01`).scrollIntoViewIfNeeded();
      await page.screenshot({
        path: testInfo.outputPath(`${key}-${width}.png`),
      });
      if (key === "E") {
        for (const code of ["E04", "E07", "E10"]) {
          const item = page.getByTestId(`check-${code}`);
          await item.scrollIntoViewIfNeeded();
          await item.screenshot({
            path: testInfo.outputPath(`${code}-${width}.png`),
          });
        }
      }
    }
  }
});
test("online navigation refreshes favicon metadata after an app release", async ({
  page,
  context,
  browserName,
}) => {
  let nextRelease = false;
  const boundary = await offlineBoundary(browserName, context, (html) =>
    nextRelease ? html.replaceAll("/icon.svg", "/icon.svg?release=next") : html,
  );
  try {
    await page.goto(boundary.url);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect(
      page.locator('link[rel="icon"][type="image/svg+xml"]'),
    ).toHaveAttribute("href", "/icon.svg");
    nextRelease = true;
    await page.reload();
    await expect(
      page.locator('link[rel="icon"][type="image/svg+xml"]'),
    ).toHaveAttribute("href", "/icon.svg?release=next");
  } finally {
    await boundary.close();
  }
});
test("production offline shell preserves edited answers across page closure and reconnects", async ({
  page,
  context,
  browserName,
}) => {
  test.setTimeout(90000);
  const boundary = await offlineBoundary(browserName, context);
  try {
    await context.addCookies([
      { name: "house-persona", value: "owner", url: boundary.url },
    ]);
    await page.goto(`${boundary.url}/?page=apartments`);
    await expect(
      page.getByRole("heading", { name: "Apartments", exact: true }),
    ).toBeVisible();
    const name = `Offline ${Date.now()}`;
    await createApartment(page, name);
    await expect(page.locator(".save-status")).toContainText("Saved");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await selectTab(page, "Viewing checklist");
    const text = page.getByTestId("check-A09");
    await boundary.offline();
    await text
      .getByRole("textbox", { name: "Answer", exact: true })
      .fill("Measured offline — 3.4 × 4.8 m");
    await expect(page.locator(".save-status")).toContainText(
      "Saved on this device",
    );
    await page.close();
    const reopened = await context.newPage();
    await reopened.goto(`${boundary.url}/?page=apartments`);
    await expect(
      reopened.getByRole("heading", { name: "Apartments", exact: true }),
    ).toBeVisible();
    await reopened.getByRole("link", { name, exact: true }).last().click();
    await selectTab(reopened, "Viewing checklist");
    await expect(
      reopened
        .getByTestId("check-A09")
        .getByRole("textbox", { name: "Answer", exact: true }),
    ).toHaveValue("Measured offline — 3.4 × 4.8 m");
    await boundary.online();
    if (browserName === "webkit")
      await reopened
        .locator(".save-status")
        .getByRole("button", { name: "Retry", exact: true })
        .click();
    await expect(reopened.locator(".save-status")).toHaveText("Saved", {
      timeout: 45000,
    });
    await reopened.reload();
    await selectTab(reopened, "Viewing checklist");
    await expect(
      reopened
        .getByTestId("check-A09")
        .getByRole("textbox", { name: "Answer", exact: true }),
    ).toHaveValue("Measured offline — 3.4 × 4.8 m");
  } finally {
    await boundary.close();
  }
});
test("private uploads are delivered to members, prepared offline and forbidden to strangers", async ({
  page,
  request,
}) => {
  await login(page);
  await page
    .getByRole("link", { name: "Kiyosumi Garden · 402", exact: true })
    .last()
    .click();
  await selectTab(page, "Photos");
  await page.locator("input[type=file]").setInputFiles({
    name: "floor-plan.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(
    page.locator(".file-tile").filter({ hasText: "floor-plan.png" }).first(),
  ).toBeVisible({ timeout: 30000 });
  const response = await page.request.get("/api/session");
  const session = await response.json(),
    cid = session.collections[0].id;
  const s = await (await page.request.get(`/api/collections/${cid}`)).json();
  const file = s.records.find(
    (r) => r.name === "floor-plan.png" && !r.archived,
  );
  expect(
    (
      await page.request.get(`/api/collections/${cid}/files/${file.id}`)
    ).status(),
  ).toBe(200);
  expect(
    (await request.get(`/api/collections/${cid}/files/${file.id}`)).status(),
  ).toBe(401);
  page.on("console", (message) => {
    if (message.text().startsWith("Viewing preparation"))
      console.log(message.text());
  });
  await page
    .getByRole("button", { name: "Prepare for viewing", exact: true })
    .click();
  await expect(page.locator(".notice")).toContainText("offline");
});
