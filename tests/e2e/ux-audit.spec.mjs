import { test, expect } from "@playwright/test";

async function login(page) {
  await page
    .context()
    .addCookies([
      { name: "house-persona", value: "owner", url: "http://127.0.0.1:3001" },
    ]);
  await page.goto("/?page=apartments");
  await expect(
    page.getByRole("heading", { name: "Apartments", exact: true }),
  ).toBeVisible();
}

test("property tabs survive reload and browser back and forward", async ({
  page,
}) => {
  await login(page);
  const visits = [];
  const record = async () =>
    visits.push({
      url: page.url(),
      title: await page.locator("h1").innerText(),
      tab: (await page.locator('[role="tab"][aria-selected="true"]').count())
        ? await page
            .locator('[role="tab"][aria-selected="true"]')
            .getAttribute("id")
        : null,
    });
  // Native browser history, never an app breadcrumb or internal Back control.
  const check = async (visit) => {
    await expect(page).toHaveURL(visit.url);
    await expect(page.locator("h1")).toHaveText(visit.title);
    if (visit.tab)
      await expect(page.locator(`#${visit.tab}`)).toHaveAttribute(
        "aria-selected",
        "true",
      );
  };
  await record();
  await page.locator(".property-name").first().click();
  await record();
  for (const name of [
    "Costs",
    "Travel",
    "Photos & files",
    "Viewing checklist",
  ]) {
    const tab = page.getByRole("tab", { name: new RegExp(`^${name}`) });
    await expect(tab).toHaveAttribute("href", /collection=.+apartment=.+tab=/);
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await record();
  }
  await page
    .locator(".sidebar:visible,.mobile-nav:visible")
    .getByRole("link", { name: /^Apartments/ })
    .first()
    .click();
  await record();
  await page.locator(".property-name").nth(1).click();
  await record();
  await page.getByRole("tab", { name: "Costs", exact: true }).click();
  await record();
  await page.reload();
  await check(visits.at(-1));
  for (const visit of visits.slice(0, -1).reverse()) {
    await page.goBack();
    await check(visit);
  }
  for (const visit of visits.slice(1)) {
    await page.goForward();
    await check(visit);
  }
});

test("monthly housing has an honest label independent of other charges", async ({
  page,
}) => {
  await login(page);
  const row = page
    .locator(".property-row")
    .filter({ hasText: "Kiyosumi Garden" });
  await expect(row.locator(".property-cost")).toContainText("Monthly housing");
  await expect(row.locator(".property-cost")).not.toContainText(
    "Known charges",
  );
});

test("missing costs explain the inputs and open their editor directly", async ({
  page,
}) => {
  await login(page);
  const name = `Browser ${Date.now()}`;
  await page
    .getByRole("button", { name: "Add apartment", exact: true })
    .click();
  await page.getByRole("dialog").getByLabel("Name", { exact: true }).fill(name);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page
    .locator(".sidebar:visible,.mobile-nav:visible")
    .getByRole("link", { name: "Apartments", exact: false })
    .first()
    .click();
  const row = page.locator(".property-row").filter({ hasText: name });
  await expect(row.locator(".property-cost")).toContainText("Missing:");
  await expect(row.locator(".property-cost")).not.toContainText("Unknown");
  await row.getByRole("link", { name: "Enter costs", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Costs", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByTestId("check-H01").getByRole("spinbutton"),
  ).toBeVisible();
  await expect(
    page.getByTestId("check-H02").getByRole("spinbutton"),
  ).toBeVisible();
});

test("search and selection survive navigation and an empty result can be reset", async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole("textbox", { name: "Search", exact: false })
    .fill("Kiyosumi");
  await page.locator(".property-row input[type=checkbox]").check();
  await page.locator(".property-name").click();
  await page.goBack();
  await expect(
    page.getByRole("textbox", { name: "Search", exact: false }),
  ).toHaveValue("Kiyosumi");
  await expect(
    page.locator(".property-row input[type=checkbox]"),
  ).toBeChecked();
  await page
    .getByRole("textbox", { name: "Search", exact: false })
    .fill("no apartment matches this");
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Search", exact: false }),
  ).toHaveValue("");
  await page
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  await expect(page.locator(".compare-tray")).toHaveCount(0);
});

test("failed initial API load offers retry and background failures never claim saved", async ({
  page,
}) => {
  let fail = true;
  await page.route(/\/api\/collections\/[^/?]+$/, (route) =>
    fail
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "SERVER_ERROR" }),
        })
      : route.continue(),
  );
  await page
    .context()
    .addCookies([
      { name: "house-persona", value: "owner", url: "http://127.0.0.1:3001" },
    ]);
  await page.goto("/?page=apartments");
  await expect(
    page.getByRole("heading", { name: "Could not load this workspace" }),
  ).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Apartments", exact: true }),
  ).toBeVisible();
  await page.route(/\/changes\?/, (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "SERVER_ERROR" }),
    }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".save-status")).toContainText("Retry");
  await expect(page.locator(".save-status")).not.toHaveText("Saved");
  await page.unroute(/\/changes\?/);
  await page
    .locator(".save-status")
    .getByRole("button", { name: "Retry", exact: true })
    .click();
  await expect(page.locator(".save-status")).toHaveText("Saved");
});

test("unsaved forms warn before leaving and tabs support keyboard navigation", async ({
  page,
}) => {
  await login(page);
  await page.locator(".property-name").first().click();
  const overview = page.getByRole("tab", { name: "Overview", exact: true });
  await overview.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: /Viewing checklist/ }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Costs", exact: true }).click();
  await page
    .getByLabel("24-month expense estimate (JPY)", { exact: true })
    .fill("123456");
  page.once("dialog", (dialog) => dialog.dismiss());
  await overview.click();
  await expect(
    page.getByLabel("24-month expense estimate (JPY)", { exact: true }),
  ).toHaveValue("123456");
  await page
    .getByLabel("24-month expense estimate (JPY)", { exact: true })
    .fill("");
  await expect(page.locator('form[data-unsaved="true"]')).toHaveCount(0);
  await page
    .getByLabel("24-month expense estimate (JPY)", { exact: true })
    .fill("123456");
  page.once("dialog", (dialog) => dialog.accept());
  await overview.click();
  await expect(overview).toHaveAttribute("aria-selected", "true");
});

test("mobile comparison keeps two distinct properties and opens their details", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 850 });
  await login(page);
  const checks = page.locator(".property-row input[type=checkbox]");
  await checks.nth(0).check();
  await checks.nth(1).check();
  await checks.nth(2).check();
  await page
    .locator(".mobile-nav")
    .getByRole("link", { name: "Compare", exact: true })
    .click();
  const pickers = page.locator(".pair-picker").getByRole("combobox");
  const first = await pickers.nth(0).innerText();
  const second = await pickers.nth(1).innerText();
  await pickers.nth(0).click();
  await page.getByRole("option", { name: second, exact: true }).click();
  await expect(pickers.nth(0)).toHaveText(second);
  await expect(pickers.nth(1)).toHaveText(first);
  await page.reload();
  await expect(pickers.nth(0)).toHaveText(second);
  await expect(pickers.nth(1)).toHaveText(first);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page
    .locator(".pair-picker")
    .getByRole("link", { name: first, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: first, exact: true }),
  ).toBeVisible();
});

// Cancelling Back must preserve both the draft and the existing Forward entry.
test("cancelled Back preserves the draft and forward history", async ({
  page,
}) => {
  await login(page);
  await page.locator(".property-name").first().click();
  await page.getByRole("tab", { name: "Costs", exact: true }).click();
  await page.getByRole("tab", { name: "Travel", exact: true }).click();
  await page.goBack();
  const estimate = page.getByLabel("24-month expense estimate (JPY)", {
    exact: true,
  });
  await estimate.fill("123456");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.goBack();
  await expect(page).toHaveURL(/tab=costs/);
  await expect(estimate).toHaveValue("123456");
  page.once("dialog", (dialog) => dialog.accept());
  await page.goForward();
  await expect(
    page.getByRole("tab", { name: "Travel", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});
