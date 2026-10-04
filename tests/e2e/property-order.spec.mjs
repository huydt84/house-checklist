import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import messages from "../../data/messages.json" with { type: "json" };

test("properties follow entry time and persist pointer, keyboard and offline reordering", async ({
  page,
  context,
  browserName,
}, testInfo) => {
  test.setTimeout(90000);
  await context.addCookies([
    { name: "house-persona", value: "owner", url: "http://127.0.0.1:3001" },
  ]);
  const session = await (await page.request.get("/api/session")).json();
  const collection = await (
    await page.request.post("/api/collections", {
      data: { name: `Order browser ${randomUUID()}` },
    })
  ).json();
  const endpoint = `/api/collections/${collection.id}`;
  const names = ["Zulu first", "Alpha second", "Middle third"];
  const ids = names.map(() => randomUUID());
  try {
    for (const [i, name] of names.entries()) {
      const response = await page.request.post(`${endpoint}/mutations`, {
        data: {
          id: randomUUID(),
          type: "apartment.put",
          targetId: ids[i],
          expectedRevision: 0,
          payload: { name },
        },
      });
      expect(response.ok()).toBeTruthy();
    }
    await page.goto(`/?collection=${collection.id}`);
    await expect(page.locator(".property-name")).toHaveText(names);
    // Renaming a property must not change its position.
    const initial = await (await page.request.get(endpoint)).json();
    await page.request.post(`${endpoint}/mutations`, {
      data: {
        id: randomUUID(),
        type: "apartment.put",
        targetId: ids[0],
        expectedRevision: initial.apartments.find((a) => a.id === ids[0])
          .revision,
        payload: { name: "Zulu renamed" },
      },
    });
    names[0] = "Zulu renamed";
    await page.reload();
    await expect(page.locator(".property-name")).toHaveText(names);
    for (const width of [320, 390, 1440, 1920]) {
      await page.setViewportSize({ width, height: width < 700 ? 1000 : 1100 });
      const source = page.getByRole("button", {
        name: `Reorder property: ${names[2]}`,
        exact: true,
      });
      await source.scrollIntoViewIfNeeded();
      const handle = await source.boundingBox();
      const target = await page.locator(".property-row").first().boundingBox();
      await page.mouse.move(
        handle.x + handle.width / 2,
        handle.y + handle.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        target.x + target.width / 2,
        Math.max(40, target.y + 5),
        {
          steps: 12,
        },
      );
      await expect(page.locator(".property-name").first()).toHaveText(names[2]);
      await page.mouse.up();
      names.unshift(names.pop());
      await expect(page.locator(".property-name")).toHaveText(names);
      await expect(page.locator(".save-status")).toHaveText("Saved");
      await page.reload();
      await expect(page.locator(".property-name")).toHaveText(names);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await page.screenshot({
        path: testInfo.outputPath(`order-${width}.png`),
      });
    }
    await context.setOffline(true);
    const first = page.getByRole("button", {
      name: `Reorder property: ${names[0]}`,
      exact: true,
    });
    await first.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
    [names[0], names[1]] = [names[1], names[0]];
    await expect(page.locator(".property-name")).toHaveText(names);
    await expect(page.locator(".save-status")).toContainText(
      "Saved on this device",
    );
    await context.setOffline(false);
    await expect(page.locator(".save-status")).toHaveText("Saved");
    await page.reload();
    await expect(page.locator(".property-name")).toHaveText(names);
    // Cancellation keeps the saved order.
    await page
      .getByRole("button", {
        name: `Reorder property: ${names[0]}`,
        exact: true,
      })
      .focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Escape");
    await expect(page.locator(".property-name")).toHaveText(names);
    if (browserName === "chromium") {
      // Dispatch trusted touch input to cover touch-action and pointer capture.
      await page.setViewportSize({ width: 390, height: 1000 });
      const handle = page.getByRole("button", {
        name: `Reorder property: ${names[2]}`,
        exact: true,
      });
      await handle.scrollIntoViewIfNeeded();
      const box = await handle.boundingBox();
      const target = await page.locator(".property-row").first().boundingBox();
      const touch = await context.newCDPSession(page);
      await touch.send("Emulation.setTouchEmulationEnabled", {
        enabled: true,
        maxTouchPoints: 1,
      });
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
      });
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: target.x + target.width / 2, y: Math.max(40, target.y + 5) },
        ],
      });
      await expect(page.locator(".property-name").first()).toHaveText(names[2]);
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await touch.detach();
      names.unshift(names.pop());
      await expect(page.locator(".property-name")).toHaveText(names);
      await expect(page.locator(".save-status")).toHaveText("Saved");
    }
    // A later entry appends without disturbing the custom order.
    const laterId = randomUUID();
    const added = await page.request.post(`${endpoint}/mutations`, {
      data: {
        id: randomUUID(),
        type: "apartment.put",
        targetId: laterId,
        expectedRevision: 0,
        payload: { name: "Later entry" },
      },
    });
    expect(added.ok()).toBeTruthy();
    names.push("Later entry");
    await page.reload();
    await expect(page.locator(".property-name")).toHaveText(names);
    // Reordering a filtered subset must leave hidden properties in their slots.
    const beforeFilter = await (await page.request.get(endpoint)).json();
    for (const name of [names[0], names[2]]) {
      const property = beforeFilter.apartments.find((a) => a.name === name);
      const response = await page.request.post(`${endpoint}/mutations`, {
        data: {
          id: randomUUID(),
          type: "apartment.put",
          targetId: property.id,
          expectedRevision: property.revision,
          payload: { status: "shortlisted" },
        },
      });
      expect(response.ok()).toBeTruthy();
    }
    await page.reload();
    await page
      .locator(".list-toolbar")
      .getByRole("combobox", { name: "Status", exact: true })
      .click();
    await page
      .getByRole("option", { name: "Shortlisted", exact: true })
      .click();
    await expect(page.locator(".property-name")).toHaveText([
      names[0],
      names[2],
    ]);
    await page
      .getByRole("button", {
        name: `Reorder property: ${names[0]}`,
        exact: true,
      })
      .focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
    [names[0], names[2]] = [names[2], names[0]];
    await expect(page.locator(".save-status")).toHaveText("Saved");
    await page
      .locator(".list-toolbar")
      .getByRole("combobox", { name: "Status", exact: true })
      .click();
    await page
      .getByRole("option", { name: "All statuses", exact: true })
      .click();
    await expect(page.locator(".property-name")).toHaveText(names);
    // A concurrent device cannot silently overwrite an offline reorder.
    await context.setOffline(true);
    await page
      .getByRole("button", {
        name: `Reorder property: ${names[0]}`,
        exact: true,
      })
      .focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
    [names[0], names[1]] = [names[1], names[0]];
    await expect(page.locator(".property-name")).toHaveText(names);
    const remote = await (await page.request.get(endpoint)).json();
    const response = await page.request.post(`${endpoint}/mutations`, {
      data: {
        id: randomUUID(),
        type: "apartments.reorder",
        targetId: collection.id,
        expectedRevision: remote.collection.apartmentOrderRevision,
        payload: {
          apartmentOrder: [...remote.collection.apartmentOrder].reverse(),
        },
      },
    });
    expect(response.ok()).toBeTruthy();
    await context.setOffline(false);
    await expect(page.locator(".save-status")).toContainText("Retry needed");
    await page.locator(".save-status button").click();
    const conflict = page.getByRole("dialog");
    await expect(conflict.locator("ol").last().locator("li")).toHaveText(names);
    await conflict
      .getByRole("button", { name: "Save my draft", exact: true })
      .click();
    await expect(page.locator(".save-status")).toHaveText("Saved");
    await page.reload();
    await expect(page.locator(".property-name")).toHaveText(names);
  } finally {
    process.env.LOCAL_AUTH = "true";
    const { pool, closeDb } = await import("../../lib/db.mjs");
    try {
      await pool().query(
        "DELETE FROM collections WHERE id=$1 AND owner_id=$2",
        [collection.id, session.user.id],
      );
    } finally {
      await closeDb();
    }
  }
});

test("reorder controls respect collection roles and reflow across locales and themes", async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(90000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const role of ["viewer", "editor"]) {
    await context.addCookies([
      { name: "house-persona", value: role, url: "http://127.0.0.1:3001" },
    ]);
    await page.goto("/?page=apartments");
    await page.reload();
    await expect(page.locator(".property-row").first()).toBeVisible();
    const handles = page.getByRole("button", { name: /^Reorder property:/ });
    if (role === "viewer") await expect(handles).toHaveCount(0);
    else await expect(handles.first()).toBeEnabled();
  }
  for (const locale of ["en", "ja", "vi"]) {
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        ({ locale, theme }) => {
          localStorage.setItem("house-language", locale);
          localStorage.setItem("house-theme", theme);
        },
        { locale, theme },
      );
      await page.reload();
      for (const width of [320, 390, 1440, 1920]) {
        await page.setViewportSize({
          width,
          height: width < 700 ? 1000 : 1100,
        });
        const handle = page.locator(".property-reorder-handle").first();
        await expect(handle).toHaveText(messages.reorder[locale]);
        const bounds = await handle.boundingBox();
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBeTruthy();
        await page.screenshot({
          path: testInfo.outputPath(`order-${locale}-${theme}-${width}.png`),
        });
      }
    }
  }
  expect(errors).toEqual([]);
});
