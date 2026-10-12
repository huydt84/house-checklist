import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { t } from "../../lib/i18n.mjs";

let collection, endpoint, apartment, fixture;
test("overview station access shares saved answers with Travel and keeps journeys separate", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  await page.request.post("/api/profile", { data: { locale: "en" } });
  await page.evaluate(() => localStorage.setItem("house-language", "en"));
  await page.reload();
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  const overview = page.getByRole("region", { name: "Travel", exact: true });
  await expect(
    overview.getByRole("button", { name: "Add journey scenario", exact: true }),
  ).toBeEnabled();
  const createScenario = async (name, person) => {
    const response = await page.request.post(`${endpoint}/mutations`, {
      data: {
        id: randomUUID(),
        targetId: randomUUID(),
        type: "scenario.put",
        expectedRevision: 0,
        payload: {
          name,
          person,
          purpose: "work",
          origin: "Apartment",
          destination: "Office",
          returnDestination: "Apartment",
          frequency: 5,
          frequencyUnit: "week",
        },
      },
    });
    expect(response.ok()).toBe(true);
    return (await response.json()).record;
  };
  const first = await createScenario("Office commute", "Alice");
  const second = await createScenario("Office commute", "Bob");
  await page.reload();
  await overview.getByRole("combobox").click();
  await page
    .getByRole("option", {
      name: `${first.person} · ${first.name}`,
      exact: true,
    })
    .click();
  const duration = page
    .getByTestId("check-B02.duration")
    .getByRole("spinbutton");
  const distance = page
    .getByTestId("check-B02.distance")
    .getByRole("spinbutton");
  const route = page.getByTestId("check-B01").getByRole("textbox");
  await expect(duration).toHaveValue("");
  await expect(distance).toHaveValue("");
  await duration.fill("8");
  await distance.fill("640");
  await route.fill("Apartment → Kiyosumi-Shirakawa station, Hanzomon line");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  const savedValues = async (scenarioId) => {
    const saved = await (await page.request.get(endpoint)).json();
    return ["B02.duration", "B02.distance", "B01"].map(
      (key) =>
        saved.answers.find(
          (a) =>
            a.scenarioId === scenarioId &&
            a.criterionId === fixture.criteria.find((c) => c.key === key).id,
        )?.value,
    );
  };
  await expect
    .poll(() => savedValues(first.id))
    .toEqual([8, 640, "Apartment → Kiyosumi-Shirakawa station, Hanzomon line"]);
  await overview.getByRole("combobox").click();
  await page
    .getByRole("option", {
      name: `${second.person} · ${second.name}`,
      exact: true,
    })
    .click();
  await expect(duration).toHaveValue("");
  await expect(distance).toHaveValue("");
  await duration.fill("0");
  await distance.fill("0");
  await expect.poll(() => savedValues(second.id)).toEqual([0, 0, undefined]);
  await page.getByRole("tab", { name: "Travel", exact: true }).click();
  await expect(duration).toHaveValue("0");
  await expect(distance).toHaveValue("0");
  await duration.fill("12");
  await expect.poll(async () => (await savedValues(second.id))[0]).toBe(12);
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await expect(duration).toHaveValue("12");
  await overview.getByRole("combobox").click();
  await page
    .getByRole("option", {
      name: `${first.person} · ${first.name}`,
      exact: true,
    })
    .click();
  await expect(duration).toHaveValue("8");
  await expect(distance).toHaveValue("640");
  await expect(route).toHaveValue(
    "Apartment → Kiyosumi-Shirakawa station, Hanzomon line",
  );
  for (const [width, locale, theme] of [
    [320, "ja", "light"],
    [390, "vi", "dark"],
    [1440, "en", "light"],
    [1920, "vi", "light"],
  ]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.request.post("/api/profile", { data: { locale } });
    await page.evaluate(
      ({ locale, theme }) => {
        localStorage.setItem("house-language", locale);
        localStorage.setItem("house-theme", theme);
      },
      { locale, theme },
    );
    await page.reload();
    await expect(duration).toHaveValue("8");
    await expect(distance).toHaveValue("640");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width < 700) await page.setViewportSize({ width, height: 1600 });
    await page
      .getByRole("region", { name: t(locale, "travel"), exact: true })
      .screenshot({
        path: testInfo.outputPath(`overview-travel-${width}.png`),
      });
  }
  await page.request.post("/api/profile", { data: { locale: "en" } });
});
test("bicycle parking availability and monthly numeric fee persist in the viewing checklist and costs", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  const section = fixture.sections.find((s) => s.key === "G");
  await page.goto(
    `/?collection=${collection.id}&page=apartment&apartment=${apartment.id}&tab=viewing&viewSection=${section.id}&viewStage=V`,
  );
  const parking = page.getByTestId("check-G05");
  const fee = page.getByTestId("check-G06");
  const amount = fee.getByRole("spinbutton", { name: /Answer/, exact: false });
  await expect(parking).toBeVisible();
  await expect(fee).toBeVisible();
  await parking.getByRole("button", { name: "Yes", exact: true }).click();
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await amount.fill("1200");
  const savedAnswer = async (key) => {
    const saved = await (await page.request.get(endpoint)).json();
    return saved.answers.find(
      (a) => a.criterionId === fixture.criteria.find((c) => c.key === key).id,
    );
  };
  await expect.poll(async () => (await savedAnswer("G06"))?.value).toBe(1200);
  for (const [width, locale, theme] of [
    [320, "ja", "light"],
    [390, "vi", "dark"],
    [1440, "en", "light"],
    [1920, "vi", "light"],
  ]) {
    await page.setViewportSize({ width, height: 900 });
    await page.request.post("/api/profile", { data: { locale } });
    await page.evaluate(
      ({ locale, theme }) => {
        localStorage.setItem("house-language", locale);
        localStorage.setItem("house-theme", theme);
      },
      { locale, theme },
    );
    await page.reload();
    await expect(
      parking.getByRole("button", { name: t(locale, "yes"), exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(fee.getByRole("spinbutton").first()).toHaveValue("1200");
    await fee.scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    if (width < 700) await page.setViewportSize({ width, height: 1600 });
    await fee.evaluate((element) => element.scrollIntoView({ block: "start" }));
    await page.evaluate(() => window.scrollBy(0, -100));
    await fee.screenshot({
      path: testInfo.outputPath(`bicycle-fee-${width}.png`),
    });
    await parking.evaluate((element) =>
      element.scrollIntoView({ block: "start" }),
    );
    await page.evaluate(() => window.scrollBy(0, -100));
    await parking.screenshot({
      path: testInfo.outputPath(`bicycle-parking-${width}.png`),
    });
  }
  await page.request.post("/api/profile", { data: { locale: "en" } });
  await page.evaluate(() => localStorage.setItem("house-language", "en"));
  await page.reload();
  await parking.getByRole("button", { name: "No", exact: true }).click();
  await expect.poll(async () => (await savedAnswer("G05"))?.value).toBe(false);
  await amount.fill("0");
  await expect.poll(async () => (await savedAnswer("G06"))?.value).toBe(0);
  await page.reload();
  await expect(
    parking.getByRole("button", { name: "No", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(amount).toHaveValue("0");
  await page.getByRole("tab", { name: "Costs", exact: true }).click();
  await expect(fee.getByRole("spinbutton").first()).toHaveValue("0");
});

test("loft can be checked and unchecked without losing the layout, and persists after reload", async ({
  page,
}, testInfo) => {
  await page.goto(
    `/?collection=${collection.id}&page=apartment&apartment=${apartment.id}&tab=viewing&viewSection=${fixture.sections.find((s) => s.key === "A").id}`,
  );
  const check = page.getByTestId("check-A03");
  const loft = check.getByRole("checkbox", {
    name: /^(Has loft|Có loft|ロフトあり)$/,
  });
  const storedLoft = async () => {
    const saved = await (await page.request.get(endpoint)).json();
    return saved.answers.find(
      (a) => a.criterionId === fixture.criteria.find((c) => c.key === "A03").id,
    )?.hasLoft;
  };
  await check.getByRole("combobox", { name: "Answer", exact: true }).click();
  await page.getByRole("option", { name: "1K", exact: true }).click();
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await loft.check();
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await expect.poll(storedLoft).toBe(true);
  await page.reload();
  await expect(loft).toBeChecked();
  await expect(
    check.getByRole("combobox", { name: "Answer", exact: true }),
  ).toContainText("1K");
  for (const [width, locale, theme] of [
    [320, "ja", "light"],
    [390, "vi", "dark"],
    [1440, "en", "light"],
    [1920, "vi", "light"],
  ]) {
    await page.setViewportSize({ width, height: 900 });
    await page.request.post("/api/profile", { data: { locale } });
    await page.evaluate(
      ({ locale, theme }) => {
        localStorage.setItem("house-language", locale);
        localStorage.setItem("house-theme", theme);
      },
      { locale, theme },
    );
    await page.reload();
    const localizedLoft = check.getByRole("checkbox", {
      name: t(locale, "hasLoft"),
      exact: true,
    });
    await localizedLoft.scrollIntoViewIfNeeded();
    await expect(localizedLoft).toBeChecked();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await check.screenshot({ path: testInfo.outputPath(`loft-${width}.png`) });
  }
  await page.request.post("/api/profile", { data: { locale: "en" } });
  await page.evaluate(() => localStorage.setItem("house-language", "en"));
  await page.reload();
  await loft.uncheck();
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await expect.poll(storedLoft).toBe(false);
  await page.reload();
  await expect(loft).not.toBeChecked();
  const saved = await (await page.request.get(endpoint)).json();
  const answer = saved.answers.find(
    (a) => a.criterionId === fixture.criteria.find((c) => c.key === "A03").id,
  );
  expect(answer.hasLoft).toBe(false);
  expect(answer.value).toBe("1K");
  await check
    .getByRole("checkbox", {
      name: new RegExp(
        ["en", "ja", "vi"]
          .map((locale) => t(locale, "not_applicable"))
          .join("|"),
      ),
    })
    .check();
  await expect(loft).toBeDisabled();
});

test("property search crosses checklist, costs and people while keeping journeys out of the checklist", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  const create = async (type, payload, extra = {}) => {
    const response = await page.request.post(`${endpoint}/mutations`, {
      data: {
        id: randomUUID(),
        targetId: randomUUID(),
        type,
        expectedRevision: 0,
        payload,
        ...extra,
      },
    });
    expect(response.ok()).toBeTruthy();
    return (await response.json()).record;
  };
  const alice = await create("scenario.put", {
    name: "Office commute",
    person: "Alice",
    purpose: "work",
    origin: "Home",
    destination: "Office",
    returnDestination: "Home",
    frequency: 5,
    frequencyUnit: "week",
  });
  await create("scenario.put", {
    name: "Gym journey",
    person: "Bob",
    purpose: "custom",
    origin: "Home",
    destination: "Gym",
    returnDestination: "Home",
    frequency: 2,
    frequencyUnit: "week",
  });
  await create(
    "record.put",
    {
      kind: "cost",
      name: "Special cleaning fee",
      amount: 15000,
      frequencyUnit: "once",
    },
    { apartmentId: apartment.id },
  );
  const sectionB = fixture.sections.find((s) => s.key === "B");
  await page.goto(
    `/?collection=${collection.id}&page=apartment&apartment=${apartment.id}&tab=viewing&viewSection=${sectionB.id}`,
  );
  await expect(page.getByTestId("check-A02")).toBeVisible();
  await expect(page.locator(".section-nav")).not.toContainText(
    sectionB.labels.en,
  );
  await page.getByRole("tab", { name: "Travel", exact: true }).click();
  await page.locator(".travel-heading").getByRole("combobox").click();
  await page
    .getByRole("option", { name: "Alice · Office commute", exact: true })
    .click();
  for (const key of [
    "B01",
    "B02.distance",
    "B02.duration",
    "B05",
    "B06",
    "B03",
    "B07.one_way",
  ])
    await expect(page.getByTestId(`check-${key}`)).toBeVisible();

  for (const [width, locale, theme] of [
    [320, "ja", "light"],
    [390, "vi", "dark"],
    [1440, "en", "light"],
    [1920, "vi", "light"],
  ]) {
    await page.setViewportSize({ width, height: width < 700 ? 850 : 1000 });
    await page.request.post("/api/profile", { data: { locale } });
    await page.evaluate(
      ({ locale, theme }) => {
        localStorage.setItem("house-language", locale);
        localStorage.setItem("house-theme", theme);
      },
      { locale, theme },
    );
    await page.reload();
    await page
      .getByRole("tab", { name: t(locale, "overview"), exact: true })
      .click();
    await expect(
      page.getByRole("tab", { name: t(locale, "overview"), exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".overview-top")).toBeVisible();
    const search = page.getByRole("searchbox", {
      name: t(locale, "searchCriteria"),
      exact: true,
    });
    await expect(search).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.mouse.move(0, 0);
    await page.evaluate(async () => {
      await Promise.all(
        document
          .querySelector(".detail-tabs")
          .getAnimations({ subtree: true })
          .map((animation) => animation.finished.catch(() => {})),
      );
    });
    await page.screenshot({
      path: `.impeccable/review/criteria-header-${testInfo.project.name}-${width}.png`,
    });
    await search.fill("F03");
    await expect(page.getByTestId("check-F03")).toBeVisible();
    await expect(page.getByTestId("check-H01")).toHaveCount(0);
    await page.screenshot({
      path: `.impeccable/review/criteria-results-${testInfo.project.name}-${width}.png`,
    });
    if (width < 700) await page.setViewportSize({ width, height: 1600 });
    await page.getByTestId("check-F03").scrollIntoViewIfNeeded();
    await page.getByTestId("check-F03").screenshot({
      path: `.impeccable/review/criteria-card-${testInfo.project.name}-${width}.png`,
    });
    if (width < 700) await page.setViewportSize({ width, height: 850 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await search.fill(
      locale === "vi"
        ? "hinh thuc internet"
        : fixture.criteria.find((c) => c.key === "F03").labels[locale],
    );
    await expect(page.getByTestId("check-F03")).toBeVisible();
    for (const keyword of [
      "deposit",
      "敷金",
      "tien dat coc",
      "deposit tiền đặt cọc",
    ]) {
      await search.fill(keyword);
      await expect(page.getByTestId("check-H03")).toBeVisible();
      await expect(
        page.getByTestId("check-H03").getByRole("heading", {
          name: fixture.criteria.find((c) => c.key === "H03").labels[locale],
          exact: true,
        }),
      ).toBeVisible();
    }
    await search.fill("H01");
    await expect(
      page.getByRole("heading", { name: t(locale, "costs"), exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("check-H01")).toBeVisible();
    await search.fill("B07.one_way Alice");
    await expect(page.getByTestId("check-B07.one_way")).toHaveCount(1);
    await expect(page.locator(".criteria-search-context")).toContainText(
      "Alice",
    );
    await search.press("Escape");
    await expect(search).toHaveValue("");
    await expect(page.locator(".overview-top")).toBeVisible();
  }
  await page.request.post("/api/profile", { data: { locale: "en" } });
  await page.evaluate(() => localStorage.setItem("house-language", "en"));
  await page.reload();
  const search = page.getByRole("searchbox", {
    name: "Search criteria",
    exact: true,
  });
  await search.fill("H01");
  await page.getByTestId("check-H01").getByRole("spinbutton").fill("76543");
  await expect
    .poll(async () => {
      const s = await (await page.request.get(endpoint)).json();
      return s.answers.find(
        (a) =>
          a.criterionId === fixture.criteria.find((c) => c.key === "H01").id,
      )?.value;
    })
    .toBe(76543);
  const viewingProgress = page.locator("#tab-viewing > span");
  await expect(viewingProgress).toContainText("1/");
  const progressBeforeFare = await viewingProgress.textContent();
  await search.fill("B07.one_way Alice");
  await page
    .getByTestId("check-B07.one_way")
    .getByRole("spinbutton")
    .fill("250");
  await expect
    .poll(async () => {
      const s = await (await page.request.get(endpoint)).json();
      return s.answers.find(
        (a) =>
          a.criterionId ===
            fixture.criteria.find((c) => c.key === "B07.one_way").id &&
          a.scenarioId === alice.id,
      )?.value;
    })
    .toBe(250);
  await expect(viewingProgress).toHaveText(progressBeforeFare);
  const saved = await (await page.request.get(endpoint)).json();
  expect(
    saved.answers.find(
      (a) => a.criterionId === fixture.criteria.find((c) => c.key === "H01").id,
    )?.value,
  ).toBe(76543);
  const fare = saved.answers.filter(
    (a) =>
      a.criterionId ===
      fixture.criteria.find((c) => c.key === "B07.one_way").id,
  );
  expect(fare).toHaveLength(1);
  expect(fare[0]).toMatchObject({
    apartmentId: apartment.id,
    scenarioId: alice.id,
    value: 250,
  });
  await search.fill("Special cleaning fee");
  await page
    .getByRole("link", { name: "Special cleaning fee", exact: true })
    .click();
  await expect(search).toHaveValue("");
  await expect(
    page.getByRole("tab", { name: "Costs", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".cost-record-row")).toContainText(
    "Special cleaning fee",
  );
  await search.fill("J01");
  await expect(page.getByTestId("check-J01")).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: t("en", "noMatchingChecks"),
      exact: true,
    }),
  ).toBeVisible();
  await search.fill("qwerty-nothing-matches");
  await expect(
    page.getByRole("heading", {
      name: t("en", "noMatchingChecks"),
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(search).toBeFocused();
  await expect(
    page.getByRole("tab", { name: "Costs", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  expect(runtimeErrors).toEqual([]);
});
test.beforeEach(async ({ page, context }) => {
  await context.addCookies([
    { name: "house-persona", value: "owner", url: "http://127.0.0.1:3001" },
  ]);
  collection = await (
    await page.request.post("/api/collections", {
      data: { name: `Criteria regression ${randomUUID()}` },
    })
  ).json();
  endpoint = `/api/collections/${collection.id}`;
  const response = await page.request.post(`${endpoint}/mutations`, {
    data: {
      id: randomUUID(),
      targetId: randomUUID(),
      type: "apartment.put",
      expectedRevision: 0,
      payload: { name: "Criteria fixture" },
    },
  });
  expect(response.ok()).toBeTruthy();
  apartment = (await response.json()).record;
  fixture = await (await page.request.get(endpoint)).json();
  await page.goto(
    `/?collection=${collection.id}&page=apartment&apartment=${apartment.id}&tab=viewing&viewSection=${fixture.sections.find((s) => s.key === "F").id}`,
  );
  await page.evaluate(() => localStorage.setItem("house-language", "en"));
  await page.reload();
});
test.afterEach(async () => {
  process.env.LOCAL_AUTH = "true";
  const { pool } = await import("../../lib/db.mjs");
  if (collection?.id)
    await pool().query("DELETE FROM collections WHERE id=$1", [collection.id]);
});

test("editing an answer and its evidence preserves suitability after saving and reloading", async ({
  page,
}) => {
  const check = page.getByTestId("check-F03");
  const meets = check.getByRole("button", {
    name: "Meets my needs",
    exact: true,
  });
  await check.getByRole("combobox", { name: "Answer", exact: true }).click();
  await page.getByRole("option", { name: "Included", exact: true }).click();
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await meets.click();
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await expect(meets).toHaveAttribute("aria-pressed", "true");
  await check.getByRole("combobox", { name: "Answer", exact: true }).click();
  await page.getByRole("option", { name: "Unknown", exact: true }).click();
  await expect(meets).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await check.locator(".evidence summary").click();
  await check
    .getByRole("textbox", { name: "Notes", exact: true })
    .fill("Confirm the internet contract with the agent");
  const criterionId = fixture.criteria.find((c) => c.key === "F03").id;
  await expect
    .poll(async () => {
      const s = await (await page.request.get(endpoint)).json();
      return s.answers.find((a) => a.criterionId === criterionId)?.notes;
    })
    .toBe("Confirm the internet contract with the agent");
  await page.reload();
  await expect(meets).toHaveAttribute("aria-pressed", "true");
  const saved = await (await page.request.get(endpoint)).json();
  const answer = saved.answers.find(
    (a) => a.criterionId === fixture.criteria.find((c) => c.key === "F03").id,
  );
  expect(answer.value).toBe("unknown");
  expect(answer.notes).toBe("Confirm the internet contract with the agent");
  expect(answer.suitability).toBe("meets");
  await check.getByRole("button", { name: "Unassessed", exact: true }).click();
  await expect
    .poll(async () => {
      const s = await (await page.request.get(endpoint)).json();
      return s.answers.find((a) => a.criterionId === criterionId)?.suitability;
    })
    .toBe("unassessed");
  await page.reload();
  await expect(
    check.getByRole("button", { name: "Unassessed", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
