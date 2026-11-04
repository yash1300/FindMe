import http from "node:http";
import { expect, type Page, test } from "@playwright/test";
import { logIn, PASSWORD, registerAndConfirm, resetRateLimits, serviceRest, uniqueIdentity } from "./helpers";

test.beforeEach(resetRateLimits);

const REAL_BROWSER = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

async function publish(page: Page) {
  await page.goto("/dashboard/my-page");
  await page.getByRole("button", { name: "Publish page" }).click();
  await expect(page.getByTestId("publish-status")).toHaveText("Published");
}

async function accountIdOf(username: string): Promise<{ owner_id: string; id: string }> {
  const [row] = await (await serviceRest(`profiles?username=eq.${username}&select=owner_id,id`)).json();
  return row;
}

async function makeStaff(username: string, role: "admin" | "moderator") {
  const { owner_id: ownerId } = await accountIdOf(username);
  const response = await serviceRest("admin_roles", { method: "POST", body: JSON.stringify({ user_id: ownerId, role }) });
  expect(response.ok).toBe(true);
}

/** Staff can't delete their accounts, so tests remove the role again to keep the database tidy. */
async function removeStaff(username: string) {
  const { owner_id: ownerId } = await accountIdOf(username);
  await serviceRest(`admin_roles?user_id=eq.${ownerId}`, { method: "DELETE" });
}

function requestWithHost(path: string, host: string): Promise<{ status: number; location?: string; body: string }> {
  return new Promise((resolve, reject) => {
    http
      .get({ host: "127.0.0.1", port: 3000, path, headers: { host, "user-agent": REAL_BROWSER } }, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, location: res.headers.location, body }));
      })
      .on("error", reject);
  });
}

test.describe("several pages", () => {
  test("each page has its own content and link, and can be switched and deleted", async ({ page }) => {
    const identity = await registerAndConfirm(page);
    const second = uniqueIdentity("second");

    await page.goto("/dashboard/pages");
    await page.getByLabel("Username").fill(second.username);
    await page.getByLabel("Display name").fill("Second Page");
    await page.getByRole("button", { name: "Create page" }).click();
    await expect(page).toHaveURL(/\/dashboard\/my-page$/);
    await expect(page.getByLabel("Display name").filter({ visible: true }).first()).toHaveValue("Second Page");

    await page.goto("/dashboard/links");
    await page.getByRole("button", { name: "Add block" }).click();
    await page.getByRole("button", { name: /^Heading/ }).click();
    await page.getByLabel("Heading", { exact: true }).fill("Only on the second");
    await page.getByRole("button", { name: "Add heading" }).click();
    await expect(page.getByRole("button", { name: "Add block" })).toBeVisible();

    await page.goto("/dashboard/pages");
    await page.getByRole("button", { name: "Work on this page" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText(`/${identity.username}`).first()).toBeVisible();
    await page.goto("/dashboard/links");
    await expect(page.getByText("Only on the second")).toHaveCount(0);

    await page.goto("/dashboard/pages");
    const secondCard = page.getByRole("listitem").filter({ hasText: second.username });
    await secondCard.getByText("Delete this page", { exact: true }).click();
    await secondCard.getByRole("button", { name: "Delete page" }).click();
    await expect(secondCard.getByText(`Type ${second.username} to confirm`)).toBeVisible();
    await secondCard.getByLabel(/Type .* to delete/).fill(second.username);
    await secondCard.getByRole("button", { name: "Delete page" }).click();
    await expect(page.getByText(second.username)).toHaveCount(0);
  });

  test("a forged page cookie can't reach someone else's page", async ({ page, browser }) => {
    const owner = await registerAndConfirm(page);
    const { id: ownerProfile } = await accountIdOf(owner.username);

    const context = await browser.newContext();
    const attacker = await context.newPage();
    const attackerIdentity = await registerAndConfirm(attacker);
    await context.addCookies([{ name: "fm_profile", value: ownerProfile, url: "http://127.0.0.1:3000" }]);
    await attacker.goto("/dashboard");
    await expect(attacker.getByText(`/${attackerIdentity.username}`).first()).toBeVisible();
    await expect(attacker.getByText(`/${owner.username}`)).toHaveCount(0);
    await context.close();
  });
});

test.describe("custom domains", () => {
  test("a domain goes through verification, and only an active one serves a page", async ({ page }) => {
    // Lookups are cached for a minute, so the change to active takes that long to show.
    test.setTimeout(150_000);
    const identity = await registerAndConfirm(page);
    await publish(page);
    const hostname = `links-${identity.username}.findme-e2e.com`;

    await page.goto("/dashboard/domains");
    await page.getByLabel("Domain").fill("localhost");
    await page.getByRole("button", { name: "Add domain" }).click();
    await expect(page.getByText("Enter a domain you own")).toBeVisible();

    await page.getByLabel("Domain").fill(hostname);
    await page.getByRole("button", { name: "Add domain" }).click();
    await expect(page.getByText(hostname).first()).toBeVisible();
    await expect(page.getByTestId("domain-status")).toHaveText("Waiting for DNS");
    await expect(page.getByText(`_findme.${hostname}`)).toBeVisible();

    // Not verified, so it mustn't serve anything yet.
    expect((await requestWithHost("/", hostname)).status).toBe(404);

    await page.getByRole("button", { name: "Check now" }).click();
    await expect(page.getByTestId("domain-status")).toHaveText("Not verified yet", { timeout: 15_000 });
    expect((await requestWithHost("/", hostname)).status).toBe(404);

    // What the server does once DNS and hosting both check out.
    await serviceRest(`custom_domains?hostname=eq.${hostname}`, { method: "PATCH", body: JSON.stringify({ status: "active" }) });
    await expect(async () => {
      const live = await requestWithHost("/", hostname);
      expect(live.status).toBe(200);
      expect(live.body).toContain(identity.name);
    }).toPass({ timeout: 70_000 });

    // Everything else on a custom domain goes to the main site, including sign-in.
    const dashboard = await requestWithHost("/dashboard", hostname);
    expect(dashboard.status).toBe(308);
    // Locally the app address and this server match, so Next shortens it to a relative path.
    expect(dashboard.location).toMatch(/\/dashboard$/);
    expect((await requestWithHost("/login", hostname)).status).toBe(308);

    // Removing it stops it being mapped to the page in the database at once.
    await page.reload();
    page.on("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText(hostname)).toHaveCount(0);
  });

  test("an unknown domain gets a 404, not someone's page", async () => {
    expect((await requestWithHost("/", "nobody-here.findme-e2e.com")).status).toBe(404);
  });
});

test.describe("leads", () => {
  test("custom questions are collected, and exports neutralise spreadsheet formulas", async ({ page, browser }) => {
    const identity = await registerAndConfirm(page);
    await publish(page);
    await page.goto("/dashboard/links");
    await page.getByRole("button", { name: "Add block" }).click();
    await page.getByRole("button", { name: /^Contact form/ }).click();
    await page.getByLabel("Extra question 1").fill("Your budget");
    await page.getByRole("button", { name: "Add contact form" }).click();
    await expect(page.getByRole("button", { name: "Add block" })).toBeVisible();

    const visitor = await (await browser.newContext({ userAgent: REAL_BROWSER })).newPage();
    await visitor.goto(`/${identity.username}`);
    const form = visitor.locator(".fm-card").filter({ hasText: "Get in touch" });
    await form.getByLabel("Email", { exact: true }).fill("buyer@example.test");
    await form.getByLabel("Message").fill('=HYPERLINK("https://evil.example")');
    await form.getByLabel("Your budget").fill("₹5,000");
    await form.getByRole("checkbox").check();
    await form.getByRole("button", { name: "Send message" }).click();
    await expect(visitor.getByText("Your message has been sent")).toBeVisible();
    await visitor.context().close();

    await page.goto("/dashboard/audience");
    await expect(page.getByText("₹5,000")).toBeVisible();

    const csv = await page.request.get("/api/leads/export");
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    const text = await csv.text();
    expect(text).toContain('"Your budget"');
    expect(text).toContain("buyer@example.test");
    expect(text).toContain(`"'=HYPERLINK`);
  });

  test("exports need a session", async ({ request }) => {
    expect((await request.get("/api/leads/export")).status()).toBe(401);
    expect((await request.get("/api/account/export")).status()).toBe(401);
  });
});

test.describe("your data", () => {
  test("a user can download their data, including nothing of anyone else's", async ({ page, browser }) => {
    const identity = await registerAndConfirm(page);
    const otherContext = await browser.newContext();
    const other = await registerAndConfirm(await otherContext.newPage());
    await otherContext.close();

    const response = await page.request.get("/api/account/export");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.login.email).toBe(identity.email);
    expect(body.profiles.map((row: { username: string }) => row.username)).toEqual([identity.username]);
    expect(JSON.stringify(body)).not.toContain(other.username);
  });

  test("deleting an account needs confirmation and the password, then removes everything", async ({ page, request }) => {
    const identity = await registerAndConfirm(page);
    await publish(page);
    const { owner_id: ownerId } = await accountIdOf(identity.username);
    await page.goto("/dashboard/settings");
    await page.getByText("I want to delete my account").click();

    await page.getByRole("button", { name: "Delete my account" }).click();
    await expect(page.getByText("Type DELETE to confirm.")).toBeVisible();

    await page.getByLabel("Type DELETE to confirm").fill("DELETE");
    await page.getByLabel("Your password").fill("not my password at all");
    await page.getByRole("button", { name: "Delete my account" }).click();
    await expect(page.getByText("That password isn't correct.")).toBeVisible();
    expect(await (await serviceRest(`accounts?id=eq.${ownerId}&select=id`)).json()).toHaveLength(1);

    await page.getByLabel("Type DELETE to confirm").fill("DELETE");
    await page.getByLabel("Your password").fill(PASSWORD);
    await page.getByRole("button", { name: "Delete my account" }).click();
    await expect(page).toHaveURL(/127\.0\.0\.1:3000\/$/);

    expect(await (await serviceRest(`accounts?id=eq.${ownerId}&select=id`)).json()).toEqual([]);
    expect(await (await serviceRest(`profiles?username=eq.${identity.username}&select=id`)).json()).toEqual([]);
    await expect(async () => expect((await request.get(`/${identity.username}`)).status()).toBe(404)).toPass({ timeout: 15_000 });

    await logIn(page, identity.email);
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();
  });
});

test.describe("reporting and moderation", () => {
  test("a reported page can be suspended, disappears at once, and the action is logged", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const staffContext = await browser.newContext();
    const staffPage = await staffContext.newPage();
    const staff = await registerAndConfirm(staffPage);
    await makeStaff(staff.username, "moderator");

    const owner = await registerAndConfirm(page);
    await publish(page);

    const visitorContext = await browser.newContext({ userAgent: REAL_BROWSER });
    const visitor = await visitorContext.newPage();
    await visitor.goto(`/${owner.username}`);
    await visitor.getByRole("link", { name: "Report" }).click();
    await expect(visitor).toHaveURL(new RegExp(`/report\\?u=${owner.username}$`));
    await visitor.getByRole("button", { name: "Send report" }).click();
    await expect(visitor.getByText("Choose a reason.")).toBeVisible();
    await visitor.getByLabel("What's wrong?").selectOption("scam");
    await visitor.getByLabel("Details").fill("<script>alert(1)</script> asks for my UPI PIN");
    await visitor.getByRole("button", { name: "Send report" }).click();
    await expect(visitor.getByText("We'll review this report.")).toBeVisible();

    await staffPage.goto("/admin/reports");
    const card = staffPage.getByRole("listitem").filter({ hasText: `@${owner.username}` });
    await expect(card.getByText("<script>alert(1)</script> asks for my UPI PIN")).toBeVisible();
    const suspendForm = card.locator("details").filter({ hasText: "Suspend page" });
    await suspendForm.getByText("Suspend page", { exact: true }).click();
    await suspendForm.getByRole("button", { name: "Confirm: Suspend page" }).click();
    await expect(card.getByText("It's kept in the log")).toBeVisible();
    await suspendForm.getByLabel("Reason").fill("Confirmed scam");
    await suspendForm.getByRole("button", { name: "Confirm: Suspend page" }).click();
    await expect(card.getByText("Page suspended.")).toBeVisible();

    expect((await visitor.goto(`/${owner.username}`))?.status()).toBe(404);
    await visitorContext.close();

    // The owner can't lift it.
    await page.goto("/dashboard/my-page");
    await expect(page.getByTestId("publish-status")).toHaveText("Suspended");
    await expect(page.getByRole("button", { name: "Publish page" })).toHaveCount(0);

    await staffPage.goto("/admin/audit");
    await expect(staffPage.getByText("profile.suspended").first()).toBeVisible();
    await expect(staffPage.getByText("Confirmed scam").first()).toBeVisible();

    await staffPage.goto("/admin/reports");
    const open = staffPage.getByRole("listitem").filter({ hasText: `@${owner.username}` });
    const resolveForm = open.locator("details").filter({ hasText: "Mark resolved" });
    await resolveForm.getByText("Mark resolved", { exact: true }).click();
    await resolveForm.getByLabel("Reason").fill("Handled");
    await resolveForm.getByRole("button", { name: "Confirm: Mark resolved" }).click();
    await expect(staffPage.getByRole("listitem").filter({ hasText: `@${owner.username}` })).toHaveCount(0);

    await removeStaff(staff.username);
    await staffContext.close();
  });

  test("staff can find and suspend a user, who is then locked out", async ({ page, browser }) => {
    const staffContext = await browser.newContext();
    const staffPage = await staffContext.newPage();
    const staff = await registerAndConfirm(staffPage);
    await makeStaff(staff.username, "admin");

    const target = await registerAndConfirm(page);
    await staffPage.goto("/admin/users");
    await staffPage.getByLabel("Search users").fill(target.username);
    await staffPage.getByRole("button", { name: "Search" }).click();
    await staffPage.getByRole("link", { name: new RegExp(target.name) }).first().click();
    await expect(staffPage.getByText(target.email)).toBeVisible();

    const suspendForm = staffPage.locator("details").filter({ hasText: "Suspend account" });
    await suspendForm.getByText("Suspend account", { exact: true }).click();
    await suspendForm.getByLabel("Reason").fill("Repeated abuse");
    await suspendForm.getByRole("button", { name: "Confirm: Suspend account" }).click();
    await expect(staffPage.getByTestId("account-status")).toHaveText("suspended");

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/suspended$/);

    const restoreForm = staffPage.locator("details").filter({ hasText: "Restore account" });
    await restoreForm.getByText("Restore account", { exact: true }).click();
    await restoreForm.getByLabel("Reason").fill("Appeal accepted");
    await restoreForm.getByRole("button", { name: "Confirm: Restore account" }).click();
    await expect(staffPage.getByTestId("account-status")).toHaveText("active");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);

    await removeStaff(staff.username);
    await staffContext.close();
  });

  test("settings change the announcement, for admins only", async ({ page, browser }) => {
    const modContext = await browser.newContext();
    const modPage = await modContext.newPage();
    const mod = await registerAndConfirm(modPage);
    await makeStaff(mod.username, "moderator");
    await modPage.goto("/admin/settings");
    await expect(modPage.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await removeStaff(mod.username);
    await modContext.close();

    const admin = await registerAndConfirm(page);
    await makeStaff(admin.username, "admin");
    await page.goto("/admin/settings");
    await page.getByLabel(/Announcement/).fill("<b>Maintenance</b> on Sunday");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved.")).toBeVisible();
    await page.goto("/dashboard");
    await expect(page.getByTestId("announcement")).toHaveText("<b>Maintenance</b> on Sunday");

    await page.goto("/admin/settings");
    await page.getByLabel(/Announcement/).fill("");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved.")).toBeVisible();
    await removeStaff(admin.username);
  });

  test("every admin page refuses non-staff", async ({ page }) => {
    await registerAndConfirm(page);
    for (const path of ["/admin", "/admin/users", "/admin/reports", "/admin/support", "/admin/audit", "/admin/settings"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "Page not found" }), path).toBeVisible();
    }
  });
});

test.describe("maintenance job", () => {
  test("refuses anyone without the secret", async ({ request }) => {
    expect((await request.get("/api/cron/maintenance")).status()).toBe(401);
    expect((await request.get("/api/cron/maintenance", { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);
  });
});

test.describe("dark mode", () => {
  test("the button switches theme, it's remembered, and text stays readable", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).not.toHaveClass(/\bdark\b/);
    const lightBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    await page.getByRole("button", { name: "Switch between light and dark mode" }).click();
    await expect(html).toHaveClass(/\bdark\b/);
    const darkBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(darkBackground).not.toBe(lightBackground);

    await page.reload();
    await expect(html).toHaveClass(/\bdark\b/);
    await page.goto("/features");
    await expect(html).toHaveClass(/\bdark\b/);

    await page.getByRole("button", { name: "Switch between light and dark mode" }).click();
    await expect(html).not.toHaveClass(/\bdark\b/);
  });

  test("it follows the device's setting until the user chooses", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  });

  test("a creator's public page keeps its own theme in dark mode", async ({ page, browser }) => {
    const identity = await registerAndConfirm(page);
    await publish(page);
    const context = await browser.newContext({ colorScheme: "dark" });
    const visitor = await context.newPage();
    await visitor.goto(`/${identity.username}`);
    await expect(visitor.locator(".fm-page")).toHaveCSS("background-color", "rgb(243, 244, 246)");
    await context.close();
  });
});

