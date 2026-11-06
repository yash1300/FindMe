import { expect, type Page, test } from "@playwright/test";
import { ANON_KEY, PASSWORD, registerAndConfirm, resetRateLimits, serviceRest, SUPABASE_URL } from "./helpers";

test.beforeEach(resetRateLimits);

const REAL_BROWSER = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

async function publishWithLink(page: Page, title = "Tracked link") {
  const identity = await registerAndConfirm(page);
  await page.goto("/dashboard/my-page");
  await page.getByRole("button", { name: "Publish page" }).click();
  await expect(page.getByTestId("publish-status")).toHaveText("Published");
  await page.goto("/dashboard/links");
  await page.getByRole("button", { name: "Add block" }).click();
  await page.getByRole("button", { name: /^Link A button/ }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Web address").fill("example.com/destination");
  await page.getByRole("button", { name: "Add link" }).click();
  await expect(page.getByText(new RegExp(`^${title} `))).toBeVisible();
  return identity;
}

/** Polls, because events are recorded just after the response is sent. */
async function expectMetric(page: Page, testId: string, value: string) {
  await expect(async () => {
    await page.goto("/dashboard/analytics");
    await expect(page.getByTestId(testId)).toHaveText(value, { timeout: 2000 });
  }).toPass({ timeout: 25_000 });
}

test.describe("analytics", () => {
  test("counts real visits and clicks, and shows them on the dashboard", async ({ page, browser }) => {
    test.setTimeout(90_000);
    const identity = await publishWithLink(page);

    await page.goto("/dashboard/analytics");
    await expect(page.getByText("No visits in this period")).toBeVisible();
    await expect(page.getByTestId("metric-ctr")).toHaveText("–");

    const context = await browser.newContext({ userAgent: REAL_BROWSER });
    const visitor = await context.newPage();
    await visitor.goto(`/${identity.username}`);
    await expectMetric(page, "metric-views", "1");
    await expect(page.getByTestId("metric-uniques")).toHaveText("1");

    // A reload straight away isn't another view.
    await visitor.reload();
    await visitor.waitForTimeout(1000);

    const href = await visitor.getByRole("link", { name: "Tracked link" }).getAttribute("href");
    const response = await context.request.get(href!, { maxRedirects: 0, headers: { "user-agent": REAL_BROWSER } });
    expect(response.status()).toBe(302);
    expect(response.headers().location).toBe("https://example.com/destination");
    await context.close();

    await expectMetric(page, "metric-clicks", "1");
    await expect(page.getByTestId("metric-views")).toHaveText("1");
    await expect(page.getByTestId("metric-ctr")).toHaveText("100.0%");
    await expect(page.getByTestId("trend-chart")).toBeVisible();
    await expect(page.getByText("Tracked link")).toBeVisible();
    await expect(page.getByText("Android", { exact: true })).toBeVisible();
    await expect(page.getByText("Mobile", { exact: true })).toBeVisible();

    await page.getByTestId("trend-chart").hover();
    await expect(page.getByTestId("chart-tooltip")).toContainText("views");

    await page.getByText("Show as a table").click();
    await expect(page.getByRole("columnheader", { name: "Clicks" })).toBeVisible();

    for (const range of ["Today", "7 days", "90 days"]) {
      await page.getByRole("link", { name: range, exact: true }).click();
      await expect(page.getByTestId("metric-views")).toHaveText("1");
    }

    await page.getByLabel("From").fill("2020-01-01");
    await page.getByLabel("To").fill("2020-01-02");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/range=custom/);
    await expect(page.getByTestId("metric-views")).toHaveText("0");

    await page.goto("/dashboard");
    await expect(page.getByTestId("metric-views")).toHaveText("1");
  });

  test("doesn't count bots, opted-out visitors, previews or cross-site calls", async ({ page, browser, request }) => {
    test.setTimeout(90_000);
    const identity = await publishWithLink(page, "Quiet link");

    // The owner's own previews, and a bot.
    await page.goto("/dashboard/preview");
    await expect(page.getByTestId("live-preview")).toBeVisible();
    const bot = await (await browser.newContext({ userAgent: "Googlebot/2.1" })).newPage();
    await bot.goto(`/${identity.username}`);
    await bot.waitForTimeout(800);
    await bot.context().close();

    // A browser asking not to be tracked.
    const privateContext = await browser.newContext({ userAgent: REAL_BROWSER, extraHTTPHeaders: { "sec-gpc": "1" } });
    const privateVisitor = await privateContext.newPage();
    await privateVisitor.goto(`/${identity.username}`);
    await privateVisitor.waitForTimeout(800);
    await privateContext.close();

    const [{ id: profileId }] = await (await serviceRest(`profiles?username=eq.${identity.username}&select=id`)).json();
    const crossSite = await request.post("/api/events", {
      headers: { origin: "https://evil.example", "content-type": "application/json", "user-agent": REAL_BROWSER },
      data: { profileId },
    });
    expect(crossSite.status()).toBe(403);
    const garbage = await request.post("/api/events", {
      headers: { origin: "http://127.0.0.1:3000", "content-type": "application/json" },
      data: "{not json",
    });
    expect(garbage.status()).toBe(400);

    await page.waitForTimeout(1500);
    await page.goto("/dashboard/analytics");
    await expect(page.getByTestId("metric-views")).toHaveText("0");

    // A real visit still counts, which proves the checks above weren't just failing to record.
    const real = await (await browser.newContext({ userAgent: REAL_BROWSER })).newPage();
    await real.goto(`/${identity.username}`);
    await real.context().close();
    await expectMetric(page, "metric-views", "1");
  });

  test("stores no IP address or user agent", async ({ page, browser }) => {
    const identity = await publishWithLink(page, "Private link");
    const visitor = await (await browser.newContext({ userAgent: REAL_BROWSER })).newPage();
    await visitor.goto(`/${identity.username}`);
    await visitor.context().close();
    await expectMetric(page, "metric-views", "1");

    const [{ id }] = await (await serviceRest(`profiles?username=eq.${identity.username}&select=id`)).json();
    const events = await (await serviceRest(`analytics_events?profile_id=eq.${id}&select=*`)).json();
    expect(events).toHaveLength(1);
    const stored = JSON.stringify(events);
    expect(stored).not.toContain("127.0.0.1");
    expect(stored).not.toContain("Pixel 8");
    expect(events[0].visitor_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("a creator can turn analytics off", async ({ page, browser }) => {
    const identity = await publishWithLink(page, "Off link");
    await page.goto("/dashboard/my-page");
    await page.getByLabel(/Count visits to my page/).uncheck();
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    const visitor = await (await browser.newContext({ userAgent: REAL_BROWSER })).newPage();
    await visitor.goto(`/${identity.username}`);
    await visitor.waitForTimeout(1500);
    await visitor.context().close();

    await page.goto("/dashboard/analytics");
    await expect(page.getByText("Analytics is turned off")).toBeVisible();
    await expect(page.getByTestId("metric-views")).toHaveText("0");
  });

  test("clicks can't redirect anywhere but the stored address", async ({ page, request }) => {
    const identity = await publishWithLink(page, "Safe link");
    const [{ id: profileId }] = await (await serviceRest(`profiles?username=eq.${identity.username}&select=id`)).json();
    const [{ id: blockId }] = await (await serviceRest(`blocks?profile_id=eq.${profileId}&type=eq.link&select=id`)).json();

    const attempt = await request.get(`/l/${blockId}?url=https://evil.example&next=https://evil.example`, { maxRedirects: 0 });
    expect(attempt.headers().location).toBe("https://example.com/destination");

    for (const bad of ["not-a-uuid", "00000000-0000-4000-8000-000000000000", "javascript:alert(1)"]) {
      expect((await request.get(`/l/${encodeURIComponent(bad)}`, { maxRedirects: 0 })).status(), bad).toBe(404);
    }

    await serviceRest(`blocks?id=eq.${blockId}`, { method: "PATCH", body: JSON.stringify({ is_visible: false }) });
    expect((await request.get(`/l/${blockId}`, { maxRedirects: 0 })).status()).toBe(404);

    await serviceRest(`blocks?id=eq.${blockId}`, { method: "PATCH", body: JSON.stringify({ is_visible: true, ends_at: "2020-01-01T00:00:00Z" }) });
    expect((await request.get(`/l/${blockId}`, { maxRedirects: 0 })).status()).toBe(404);
  });

  test("clients can't reach raw events, or forge totals", async ({ page }) => {
    const identity = await registerAndConfirm(page);
    const token = (await (await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: identity.email, password: PASSWORD }),
    })).json()).access_token as string;

    const rest = (path: string, key: string, init: RequestInit = {}) =>
      fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { apikey: ANON_KEY, Authorization: `Bearer ${key}`, "Content-Type": "application/json" } });

    for (const key of [ANON_KEY, token]) {
      expect((await rest("analytics_events?select=*", key)).status).toBeGreaterThanOrEqual(400);
      expect((await rest("analytics_salts?select=*", key)).status).toBeGreaterThanOrEqual(400);
      expect((await rest("rpc/record_analytics_event", key, { method: "POST", body: "{}" })).status).toBeGreaterThanOrEqual(400);
      expect((await rest("rpc/admin_overview", key, { method: "POST", body: "{}" })).status).toBeGreaterThanOrEqual(400);
    }
    expect((await rest("analytics_daily", token, { method: "POST", body: JSON.stringify({ views: 9 }) })).status).toBeGreaterThanOrEqual(400);
  });
});

test.describe("admin access", () => {
  test("is hidden from everyone but admins, and works for them", async ({ page, browser }) => {
    const signedOut = await (await browser.newContext()).newPage();
    await signedOut.goto("/admin");
    await expect(signedOut).toHaveURL(/\/login\?next=%2Fadmin/);
    await signedOut.context().close();

    const identity = await registerAndConfirm(page);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByText("Registered users")).toHaveCount(0);

    const [{ id }] = await (await serviceRest(`accounts?select=id&display_name=eq.${encodeURIComponent(identity.name)}&order=created_at.desc&limit=1`)).json();
    const grant = await serviceRest("admin_roles", { method: "POST", body: JSON.stringify({ user_id: id, role: "admin" }) });
    expect(grant.ok).toBe(true);

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Admin overview" })).toBeVisible();
    await expect(page.getByTestId("admin-registered")).not.toHaveText("0");

    await serviceRest(`admin_roles?user_id=eq.${id}`, { method: "DELETE" });
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });
});
