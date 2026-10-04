import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
async function login(page, origin = "http://127.0.0.1:3001") {
  await page
    .context()
    .addCookies([{ name: "house-persona", value: "owner", url: origin }]);
  await page.goto(`${origin}/?page=apartments`);
  await expect(
    page.getByRole("heading", { name: "Apartments", exact: true }),
  ).toBeVisible();
}
test("an OAuth callback without its verification cookie offers recovery without losing the workspace", async ({
  page,
}) => {
  // Next.js's loopback OAuth request origin is localhost. Keep the synthetic
  // session on that same host instead of switching between loopback aliases.
  const origin = "http://localhost:3001";
  await login(page, origin);
  const sessionURL = new URL("/api/session", origin).href;
  const before = await (await page.request.get(sessionURL)).json();
  const callback =
    "/api/auth/callback/google?code=expired-flow-repro&state=expired-flow-repro&iss=https%3A%2F%2Faccounts.google.com";
  const response = await page.request.get(new URL(callback, origin).href, {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(302);
  const location = new URL(response.headers().location, page.url());
  expect(location.pathname).toBe("/auth-error");
  await page.goto(location.href);
  await expect(
    page.getByRole("heading", {
      name: "Sign-in could not be completed.",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Return to House Checklist", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Collections", exact: true }),
  ).toBeVisible();
  const after = await (await page.request.get(sessionURL)).json();
  expect(after.user.id).toBe(before.user.id);
  expect(after.collections.map((c) => c.id)).toEqual(
    before.collections.map((c) => c.id),
  );
});
test("same-answer conflict retains both edits and lets the user combine them", async ({
  page,
}) => {
  await login(page);
  const session = await (await page.request.get("/api/session")).json(),
    cid = session.collections[0].id;
  let s = await (await page.request.get(`/api/collections/${cid}`)).json();
  const apt = s.apartments.find((a) => a.name === "Kiyosumi Garden · 402"),
    criterion = s.criteria.find((c) => c.key === "A09");
  await page.getByRole("link", { name: apt.name, exact: true }).last().click();
  await page.getByRole("tab", { name: /Viewing checklist/ }).click();
  await page.context().setOffline(true);
  await page
    .getByTestId("check-A09")
    .getByRole("textbox", { name: "Answer", exact: true })
    .fill("Local viewing note");
  await expect(page.locator(".save-status")).toContainText(
    "Saved on this device",
  );
  // APIRequestContext remains online; this represents another authorized device.
  const old = s.answers.find(
    (a) => a.apartmentId === apt.id && a.criterionId === criterion.id,
  );
  const response = await page.request.post(
    `/api/collections/${cid}/mutations`,
    {
      data: {
        id: randomUUID(),
        targetId: old?.id || randomUUID(),
        type: "answer.put",
        expectedRevision: old?.revision || 0,
        checklistRevision: s.collection.checklistRevision,
        apartmentId: apt.id,
        criterionId: criterion.id,
        payload: {
          state: "answered",
          value: "Agent replied on another device",
        },
      },
    },
  );
  expect(response.ok()).toBeTruthy();
  await page.context().setOffline(false);
  await expect(page.locator(".save-status")).toContainText("Retry needed", {
    timeout: 30000,
  });
  await page.locator(".save-status button").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(apt.name);
  await expect(dialog).toContainText("Agent replied on another device");
  await expect(
    dialog.getByRole("textbox", { name: "Answer", exact: true }),
  ).toHaveValue("Local viewing note");
  await dialog
    .getByRole("textbox", { name: "Answer", exact: true })
    .fill("Local viewing note; agent replied");
  await dialog
    .getByRole("button", { name: "Save my draft", exact: true })
    .click();
  await expect(page.locator(".save-status")).toHaveText("Saved", {
    timeout: 30000,
  });
  s = await (await page.request.get(`/api/collections/${cid}`)).json();
  expect(
    s.answers.find(
      (a) => a.apartmentId === apt.id && a.criterionId === criterion.id,
    ).value,
  ).toBe("Local viewing note; agent replied");
});
test("changing interface language preserves canonical answer identity and keyboard focus", async ({
  page,
}) => {
  await login(page);
  const session = await (await page.request.get("/api/session")).json(),
    cid = session.collections[0].id;
  const before = await (
    await page.request.get(`/api/collections/${cid}`)
  ).json();
  const language = page
    .getByRole("button", { name: "Language", exact: true })
    .filter({ visible: true });
  await language.click();
  await page.getByRole("menuitem", { name: "日本語", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "物件", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Kiyosumi Garden · 402", exact: true })
    .last()
    .click();
  await expect(
    page.getByTestId("check-A02").getByRole("spinbutton"),
  ).toHaveValue("27.4");
  await page.getByTestId("check-A02").getByRole("spinbutton").focus();
  expect(
    await page
      .getByTestId("check-A02")
      .getByRole("spinbutton")
      .evaluate((el) => getComputedStyle(el).outlineStyle),
  ).not.toBe("none");
  const after = await (
    await page.request.get(`/api/collections/${cid}`)
  ).json();
  expect(after.answers.map((a) => a.id).sort()).toEqual(
    before.answers.map((a) => a.id).sort(),
  );
  await page.request.post("/api/profile", { data: { locale: "en" } });
});

test("storage exhaustion keeps the visible draft, reports retry and permits export", async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole("link", { name: "Kiyosumi Garden · 402", exact: true })
    .last()
    .click();
  await page.getByRole("tab", { name: /Viewing checklist/ }).click();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === "outbox")
        throw new DOMException(
          "Synthetic disk-full failure",
          "QuotaExceededError",
        );
      return original.apply(this, args);
    };
  });
  const check = page.getByTestId("check-A09");
  await check
    .getByRole("textbox", { name: "Answer", exact: true })
    .fill("Recover this measurement");
  await expect(check.getByRole("alert")).toContainText(
    "Device storage is full",
  );
  await expect(
    check.getByRole("textbox", { name: "Answer", exact: true }),
  ).toHaveValue("Recover this measurement");
  await expect(page.locator(".save-status")).toContainText("Retry needed");
  const download = page.waitForEvent("download");
  await check
    .getByRole("button", { name: "Export drafts", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe("viewing-draft.json");
});
