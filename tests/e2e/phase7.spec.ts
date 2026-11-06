import { expect, type Page, test } from "@playwright/test";
import { logOut, registerAndConfirm, resetRateLimits } from "./helpers";

test.beforeEach(resetRateLimits);

async function publish(page: Page) {
  await page.goto("/dashboard/my-page");
  await page.getByRole("button", { name: "Publish page" }).click();
  await expect(page.getByTestId("publish-status")).toHaveText("Published");
}

test.describe("logging out", () => {
  test("clears the session completely, so Log in asks again", async ({ page, context }) => {
    await registerAndConfirm(page);
    await logOut(page);
    expect((await context.cookies()).filter((cookie) => cookie.name.startsWith("sb-"))).toEqual([]);
    await page.getByRole("link", { name: "Log in" }).first().click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  });

  test("can't be triggered by another site", async ({ request }) => {
    const response = await request.post("/auth/signout", { headers: { Origin: "https://evil.example" }, maxRedirects: 0 });
    expect(response.status()).toBe(403);
  });

  test("a cancelled Google sign-in says so, instead of blaming a link", async ({ page }) => {
    await page.goto("/auth/callback?error=access_denied&error_description=cancelled");
    await expect(page).toHaveURL(/\/login\?error=oauth_cancelled$/);
    await expect(page.getByText("Google sign-in didn't finish")).toBeVisible();
  });
});

test.describe("social icons follow their block", () => {
  test("deleting the block takes the icons off the page, and they can be put back", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const identity = await registerAndConfirm(page);
    await publish(page);
    await page.getByLabel("Platform").selectOption("instagram");
    await page.getByLabel("Link").fill("instagram.com/asha");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Instagram now has its own button" })).toBeVisible();

    const visitorContext = await browser.newContext();
    const visitor = await visitorContext.newPage();
    const icons = visitor.getByRole("navigation", { name: "Social links" });
    await visitor.goto(`/${identity.username}`);
    await expect(icons).toBeVisible();
    // At the top, under the header and bio, before any buttons.
    await expect(visitor.locator(".fm-item").nth(1).getByRole("navigation", { name: "Social links" })).toBeVisible();

    await page.goto("/dashboard/links");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete Social icons" }).click();
    await expect(page.getByRole("button", { name: "Delete Social icons" })).toHaveCount(0);

    await expect(async () => {
      await visitor.goto(`/${identity.username}`);
      await expect(icons).toHaveCount(0, { timeout: 2000 });
    }).toPass({ timeout: 20_000 });
    // The button made for the link stays, as it's a separate block.
    await expect(visitor.locator(".fm-button", { hasText: "Instagram" })).toBeVisible();

    await page.goto("/dashboard");
    await expect(page.getByTestId("suggestion-icons-off")).toBeVisible();

    await page.goto("/dashboard/my-page");
    await expect(page.getByText("because you deleted its Social icons block")).toBeVisible();
    await page.getByRole("button", { name: "Show icons on my page" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Your social icons are back" })).toBeVisible();

    await expect(async () => {
      await visitor.goto(`/${identity.username}`);
      await expect(visitor.locator(".fm-item").nth(1).getByRole("navigation", { name: "Social links" })).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20_000 });

    // Only one Social icons block per page.
    await page.goto("/dashboard/links");
    await page.getByRole("button", { name: "Add block" }).click();
    await expect(page.getByRole("button", { name: /^Social icons/ })).toBeDisabled();
    await visitorContext.close();
  });
});

test.describe("phase 7", () => {
  test("suggestions, analytics comparison and CSV download", async ({ page }) => {
    await registerAndConfirm(page);
    await expect(page.getByTestId("suggestion-publish")).toBeVisible();
    await expect(page.getByTestId("suggestion-first-link")).toBeVisible();
    await page.getByTestId("suggestion-first-link").getByRole("link", { name: /Add a link/ }).click();
    await expect(page).toHaveURL(/\/dashboard\/links\?add=1$/);

    await page.goto("/dashboard/analytics?range=7");
    await expect(page.getByText("No data for the 7 days before to compare").first()).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download as CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^findme-.+\.csv$/);
  });

  test("a shared theme can be used by another creator, and its creator can stop sharing it", async ({ page, browser }) => {
    test.setTimeout(150_000);
    await registerAndConfirm(page);
    const name = `Sunset ${Date.now().toString(36)}`;
    await page.goto("/dashboard/appearance");
    await page.getByLabel("Share your saved theme").fill(name);
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Shared." })).toBeVisible();
    await expect(page.getByText(name)).toBeVisible();

    const otherContext = await browser.newContext();
    const other = await otherContext.newPage();
    await registerAndConfirm(other);
    await other.goto("/dashboard/appearance");
    const card = other.getByTestId("gallery-theme").filter({ hasText: name });
    await expect(card).toBeVisible();
    other.once("dialog", (dialog) => dialog.accept());
    await card.getByRole("button", { name: `Use ${name}` }).click();
    await expect(other).toHaveURL(/\/dashboard\/appearance\?applied=1$/);
    await expect(other.getByRole("status").filter({ hasText: "Your page now uses the theme you picked" })).toBeVisible();

    await page.reload();
    await expect(page.getByText("Used 1 time")).toBeVisible();
    await page.getByRole("button", { name: `Stop sharing ${name}` }).click();
    await expect(page.getByRole("status").filter({ hasText: "is no longer shared" })).toBeVisible();

    await other.reload();
    await expect(other.getByTestId("gallery-theme").filter({ hasText: name })).toHaveCount(0);
    await otherContext.close();
  });
});
