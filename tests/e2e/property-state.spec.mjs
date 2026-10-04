import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import messages from "../../data/messages.json" with { type: "json" };

const baseURL = "http://127.0.0.1:3001";
let createdProperty;
test.afterEach(async ({ page }) => {
  if (!createdProperty) return;
  const { collection, apartment } = createdProperty;
  createdProperty = null;
  const endpoint = `/api/collections/${collection}`;
  const snapshot = await (await page.request.get(endpoint)).json();
  const property = snapshot.apartments.find((a) => a.id === apartment);
  if (property && !property.archived) {
    const result = await page.request.post(`${endpoint}/mutations`, {
      data: {
        id: randomUUID(),
        type: "apartment.put",
        targetId: apartment,
        expectedRevision: property.revision,
        payload: { archived: true },
      },
    });
    expect(result.ok()).toBeTruthy();
  }
});
async function login(context, role) {
  await context.addCookies([
    { name: "house-persona", value: role, url: baseURL },
  ]);
}
async function choose(page, scope, label, option) {
  await scope.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
const states = (scope) => scope.locator(".apartment-state");
const saved = (page) =>
  expect(page.locator(".save-status")).toHaveText("Saved");
async function archive(page, scope) {
  await scope.getByRole("button", { name: "Archive", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Archive apartment?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

test("property address, map, decisions and viewing persist from creation through offline edits and archive/restore", async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(90000);
  await login(context, "owner");
  await page.goto("/?page=apartments");
  await page
    .getByRole("button", { name: "Add apartment", exact: true })
    .click();
  const name = `Browser ${Date.now()}`;
  const address = "1-2-3 Asagaya, Suginami-ku, Tokyo";
  const mapUrl = "https://www.google.com/maps?q=Asagaya+Tokyo";
  await expect(
    page.getByRole("dialog").getByLabel("Address", { exact: true }),
  ).toBeVisible({ timeout: 2000 });
  await page.getByRole("dialog").getByLabel("Name", { exact: true }).fill(name);
  await page
    .getByRole("dialog")
    .getByLabel("Address", { exact: true })
    .fill(address);
  await page
    .getByRole("dialog")
    .getByLabel("Google Maps URL", { exact: true })
    .fill(mapUrl);
  for (const width of [320, 390, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 700 ? 850 : 1000 });
    await expect(
      page.getByRole("dialog").getByLabel("Address", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("dialog").getByLabel("Google Maps URL", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({ path: testInfo.outputPath(`create-${width}.png`) });
  }
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await saved(page);
  const detailURL = page.url();
  const route = new URL(detailURL).searchParams;
  createdProperty = {
    collection: route.get("collection"),
    apartment: route.get("apartment"),
  };
  const detail = states(page);
  await expect(
    detail.getByRole("combobox", { name: "Status", exact: true }),
  ).toHaveText("Considering");
  await expect(
    detail.getByRole("combobox", { name: "Viewing status", exact: true }),
  ).toHaveText("Not Viewed");
  await detail.getByRole("combobox", { name: "Status", exact: true }).click();
  await expect(page.getByRole("option")).toHaveText([
    "Considering",
    "Disqualified",
    "Shortlisted",
  ]);
  await page.getByRole("option", { name: "Shortlisted", exact: true }).click();
  await choose(page, detail, "Viewing status", "Viewed");
  await saved(page);
  await page
    .locator(".detail-back")
    .getByRole("link", { name: "Apartments", exact: true })
    .click();
  const row = page
    .locator(".property-row")
    .filter({ has: page.getByRole("link", { name, exact: true }) });
  const rowStates = states(row);
  await expect(row.locator(".property-main p")).toHaveText(address);
  const mapLink = row.getByRole("link", {
    name: "Open Google Maps",
    exact: true,
  });
  await expect(mapLink).toHaveAttribute("href", mapUrl);
  await expect(mapLink).toHaveAttribute("target", "_blank");
  const listURL = page.url();
  await context.route("https://www.google.com/maps**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "Google Maps destination",
    }),
  );
  const popupPromise = page.waitForEvent("popup");
  await mapLink.click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(mapUrl);
  await popup.close();
  await context.unroute("https://www.google.com/maps**");
  await expect(page).toHaveURL(listURL);
  for (const width of [320, 390, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 700 ? 850 : 1000 });
    await expect(mapLink).toBeVisible();
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath(`list-map-${width}.png`),
    });
    await rowStates
      .getByRole("button", { name: "Archive", exact: true })
      .click();
    const confirmation = page.getByRole("dialog", {
      name: "Archive apartment?",
    });
    await expect(confirmation).toContainText(name);
    await expect(
      confirmation.getByRole("button", { name: "Cancel", exact: true }),
    ).toBeFocused();
    await page.screenshot({
      path: testInfo.outputPath(`archive-confirm-${width}.png`),
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await confirmation
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect(confirmation).toHaveCount(0);
    await expect(row).toBeVisible();
  }
  const unchanged = await (
    await page.request.get(`/api/collections/${createdProperty.collection}`)
  ).json();
  expect(
    unchanged.apartments.find((a) => a.id === createdProperty.apartment)
      .archived,
  ).toBe(false);
  await rowStates.getByRole("button", { name: "Archive", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(row).toBeVisible();
  await expect(
    rowStates.getByRole("combobox", { name: "Status", exact: true }),
  ).toHaveText("Shortlisted");
  await expect(
    rowStates.getByRole("combobox", { name: "Viewing status", exact: true }),
  ).toHaveText("Viewed");
  await context.setOffline(true);
  await choose(page, rowStates, "Status", "Disqualified");
  await choose(page, rowStates, "Viewing status", "Not Viewed");
  await expect(page.locator(".save-status")).toContainText(
    "Saved on this device",
  );
  await row.locator(".property-name").click();
  await expect(
    detail.getByRole("combobox", { name: "Status", exact: true }),
  ).toHaveText("Disqualified");
  await expect(
    detail.getByRole("combobox", { name: "Viewing status", exact: true }),
  ).toHaveText("Not Viewed");
  await context.setOffline(false);
  await saved(page);
  await page.reload();
  await expect(page.locator(".page-description")).toHaveText(address);
  await expect(
    page.getByRole("link", { name: "Google Maps URL", exact: true }),
  ).toHaveAttribute("href", mapUrl);
  await page.getByRole("tab", { name: "Costs", exact: true }).click();
  await page.getByRole("button", { name: "Edit address", exact: true }).click();
  const edit = page.getByRole("dialog");
  await expect(edit.getByLabel("Address", { exact: true })).toHaveValue(
    address,
  );
  await expect(edit.getByLabel("Google Maps URL", { exact: true })).toHaveValue(
    mapUrl,
  );
  await edit.getByLabel("Address", { exact: true }).fill(`${address} 402`);
  await edit
    .getByLabel("Google Maps URL", { exact: true })
    .fill(`${mapUrl}&zoom=15`);
  for (const width of [320, 390, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 700 ? 850 : 1000 });
    await expect(edit.getByLabel("Address", { exact: true })).toBeVisible();
    await expect(
      edit.getByLabel("Google Maps URL", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: testInfo.outputPath(`edit-address-${width}.png`),
    });
  }
  await edit.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(edit).toHaveCount(0);
  await expect(page.locator(".page-description")).toHaveText(`${address} 402`);
  await saved(page);
  await page.reload();
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await expect(page.locator(".page-description")).toHaveText(`${address} 402`);
  await expect(
    page.getByRole("link", { name: "Google Maps URL", exact: true }),
  ).toHaveAttribute("href", `${mapUrl}&zoom=15`);
  await expect(
    detail.getByRole("combobox", { name: "Status", exact: true }),
  ).toHaveText("Disqualified");
  // A canceled draft leaves the saved location intact.
  await page.getByRole("button", { name: "Edit address", exact: true }).click();
  await edit.getByLabel("Address", { exact: true }).fill("Canceled address");
  await edit.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".page-description")).toHaveText(`${address} 402`);
  // Clearing either optional field also persists through the offline queue.
  await context.setOffline(true);
  await page.getByRole("button", { name: "Edit address", exact: true }).click();
  await edit.getByLabel("Address", { exact: true }).fill("");
  await edit.getByLabel("Google Maps URL", { exact: true }).fill("");
  await edit.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(edit).toHaveCount(0);
  await expect(page.locator(".page-description")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Google Maps URL", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".save-status")).toContainText(
    "Saved on this device",
  );
  await context.setOffline(false);
  await saved(page);
  await page.reload();
  await page.getByRole("button", { name: "Edit address", exact: true }).click();
  await expect(edit.getByLabel("Address", { exact: true })).toHaveValue("");
  await expect(edit.getByLabel("Google Maps URL", { exact: true })).toHaveValue(
    "",
  );
  await edit.getByRole("button", { name: "Cancel", exact: true }).click();
  // State controls stay available across detail tabs.
  await page.getByRole("tab", { name: "Costs", exact: true }).click();
  await choose(page, detail, "Status", "Considering");
  await choose(page, detail, "Viewing status", "Viewed");
  await archive(page, detail);
  await expect(
    detail.getByRole("button", { name: "Restore", exact: true }),
  ).toBeVisible();
  await saved(page);
  await page
    .locator(".detail-back")
    .getByRole("link", { name: "Apartments", exact: true })
    .click();
  await expect(row).toHaveCount(0);
  await page
    .getByRole("button", { name: "Show archived", exact: true })
    .click();
  await expect(row).toBeVisible();
  await expect(
    row.getByRole("link", { name: "Open Google Maps", exact: true }),
  ).toHaveCount(0);
  await rowStates.getByRole("button", { name: "Restore", exact: true }).click();
  await saved(page);
  await expect(row).toHaveCount(0);
  await page
    .locator(".list-toolbar")
    .getByRole("button", { name: "Apartments", exact: true })
    .click();
  await expect(row).toBeVisible();
  await choose(page, rowStates, "Status", "Shortlisted");
  await saved(page);
  await choose(page, page.locator(".list-toolbar"), "Status", "Shortlisted");
  await expect(row).toBeVisible();
  await archive(page, rowStates);
  await saved(page);
  await page.goto(detailURL);
  await expect(
    detail.getByRole("button", { name: "Restore", exact: true }),
  ).toBeVisible();
  await expect(
    detail.getByRole("combobox", { name: "Status", exact: true }),
  ).toHaveText("Shortlisted");
  await expect(
    detail.getByRole("combobox", { name: "Viewing status", exact: true }),
  ).toHaveText("Viewed");
  await detail.getByRole("button", { name: "Restore", exact: true }).click();
  await saved(page);
  await archive(page, detail);
  await saved(page);
});

test("property state controls respect viewers and reflow across supported widths, languages and themes", async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(120000);
  await login(context, "viewer");
  await page.goto("/?page=apartments");
  await expect(page.locator(".property-row").first()).toBeVisible();
  const listURL = page.url();
  const propertyURL = await page
    .locator(".property-name")
    .first()
    .getAttribute("href");
  for (const url of [listURL, propertyURL]) {
    await page.goto(url);
    const controls = states(page).first();
    await expect(
      controls.getByRole("combobox", { name: "Status", exact: true }),
    ).toBeDisabled();
    await expect(
      controls.getByRole("combobox", { name: "Viewing status", exact: true }),
    ).toBeDisabled();
    await expect(controls.getByRole("button")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Edit address", exact: true }),
    ).toHaveCount(0);
  }
  await login(context, "editor");
  await page.goto(listURL);
  await page.reload();
  for (const locale of ["en", "ja", "vi"]) {
    await page.evaluate(
      (locale) => localStorage.setItem("house-language", locale),
      locale,
    );
    await page.goto(listURL);
    await page.reload();
    for (const theme of ["light", "dark"]) {
      await page.evaluate((theme) => {
        localStorage.setItem("house-theme", theme);
      }, theme);
      await page.reload();
      for (const width of [320, 390, 1440, 1920]) {
        await page.setViewportSize({ width, height: width < 700 ? 850 : 1000 });
        for (const [surface, url] of [
          ["list", listURL],
          ["detail", propertyURL],
        ]) {
          await page.goto(url);
          const controls = states(page).first();
          await expect(
            controls.getByRole("combobox", {
              name: messages.status[locale],
              exact: true,
            }),
          ).toBeEnabled();
          await expect(
            controls.getByRole("combobox", {
              name: messages.viewingStatus[locale],
              exact: true,
            }),
          ).toBeEnabled();
          await expect(
            controls.getByRole("button", {
              name: messages.archive[locale],
              exact: true,
            }),
          ).toBeVisible();
          if (surface === "detail") {
            await page
              .getByRole("button", {
                name: messages.editAddress[locale],
                exact: true,
              })
              .click();
            const dialog = page.getByRole("dialog");
            await expect(
              dialog.getByLabel(messages.address[locale], { exact: true }),
            ).toBeVisible();
            await expect(
              dialog.getByLabel(messages.mapUrl[locale], { exact: true }),
            ).toBeVisible();
          } else {
            await controls
              .getByRole("button", {
                name: messages.archive[locale],
                exact: true,
              })
              .click();
            const dialog = page.getByRole("dialog", {
              name: messages.archiveApartmentTitle[locale],
              exact: true,
            });
            await expect(dialog).toBeVisible();
            await expect(
              dialog.getByRole("button", {
                name: messages.cancel[locale],
                exact: true,
              }),
            ).toBeFocused();
          }
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBeTruthy();
          await page.screenshot({
            path: testInfo.outputPath(
              `${surface}-${width}-${locale}-${theme}.png`,
            ),
          });
          await page
            .getByRole("dialog")
            .getByRole("button", {
              name: messages.cancel[locale],
              exact: true,
            })
            .click();
        }
      }
    }
  }
});
