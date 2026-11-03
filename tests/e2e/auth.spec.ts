import { expect, test } from "@playwright/test";
import {
  fillRegistration,
  linkFromEmail,
  logIn,
  logOut,
  PASSWORD,
  registerAndConfirm,
  resetRateLimits,
  uniqueIdentity,
} from "./helpers";

test.beforeEach(resetRateLimits);

test.describe("registration", () => {
  test("a new user can register, confirm their email, and reach the dashboard", async ({ page }) => {
    const identity = await registerAndConfirm(page);
    await expect(page.getByRole("heading", { name: `Welcome, ${identity.name}` })).toBeVisible();
    await expect(page.getByText(`/${identity.username}`)).toBeVisible();
    await expect(page.getByText("Draft", { exact: true })).toBeVisible();
  });

  test("an unconfirmed user cannot log in, and is offered a new link", async ({ page }) => {
    const identity = uniqueIdentity();
    await fillRegistration(page, identity);
    await page.getByRole("button", { name: "Create your free page" }).click();
    await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();

    await logIn(page, identity.email);
    await expect(page.getByText("Please confirm your email address")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send a new link" })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("an unconfirmed account isn't revealed to someone with the wrong password", async ({ page }) => {
    const identity = uniqueIdentity();
    await fillRegistration(page, identity);
    await page.getByRole("button", { name: "Create your free page" }).click();
    await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();

    await logIn(page, identity.email, "not the right password");
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();
    await expect(page.getByText("Please confirm your email address")).toHaveCount(0);
  });

  test("registering with an existing email looks the same as a new signup", async ({ page }) => {
    const existing = await registerAndConfirm(page);
    await logOut(page);

    const retry = uniqueIdentity();
    await fillRegistration(page, { ...retry, email: existing.email });
    await page.getByRole("button", { name: "Create your free page" }).click();
    await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  });

  test("a taken username is flagged while typing", async ({ page }) => {
    const existing = await registerAndConfirm(page);
    await logOut(page);

    await page.goto("/register");
    await page.getByLabel("Username", { exact: true }).fill(existing.username.toUpperCase());
    await expect(page.getByText("This username isn't available.")).toBeVisible();
  });

  test("consent is required", async ({ page }) => {
    const identity = uniqueIdentity();
    await fillRegistration(page, identity);
    await page.getByLabel(/I agree to the/).uncheck();
    await page.getByRole("button", { name: "Create your free page" }).click();
    await expect(page.getByText("Please accept the Terms and Privacy Policy")).toBeVisible();
    // The other answers survive the failed attempt.
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(identity.email);
  });

  test("an invalid email link is rejected", async ({ page }) => {
    await page.goto("/auth/callback?token_hash=not-a-real-token&type=signup");
    await expect(page).toHaveURL(/\/login\?error=auth_callback/);
    await expect(page.getByText("That link is invalid or has expired.")).toBeVisible();
  });
});

test.describe("sessions", () => {
  test("a user can log out and back in", async ({ page }) => {
    const identity = await registerAndConfirm(page);
    await logOut(page);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);

    await logIn(page, identity.email);
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("a wrong password gets a generic error", async ({ page }) => {
    const identity = await registerAndConfirm(page);
    await logOut(page);

    await logIn(page, identity.email, "not the right password");
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();
    await logIn(page, `nobody-${identity.email}`, "not the right password");
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();
  });

  test("login returns to the page originally requested", async ({ page }) => {
    const identity = await registerAndConfirm(page);
    await logOut(page);

    await page.goto("/dashboard/settings");
    await expect(page).toHaveURL(/next=%2Fdashboard%2Fsettings/);
    await page.getByLabel("Email", { exact: true }).fill(identity.email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard\/settings$/);
  });

  test("login ignores an open redirect in the next parameter", async ({ page }) => {
    const identity = await registerAndConfirm(page);
    await logOut(page);

    await page.goto("/login?next=https://evil.example/phish");
    await page.getByLabel("Email", { exact: true }).fill(identity.email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/127\.0\.0\.1:3000\/dashboard$/);
  });

  test("signed-in users are sent from login to the dashboard", async ({ page }) => {
    await registerAndConfirm(page);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("protected pages redirect when signed out", async ({ page }) => {
    for (const path of ["/dashboard", "/dashboard/settings", "/onboarding"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/login\?next=/);
    }
  });
});

test.describe("password recovery", () => {
  test("a user can reset a forgotten password with an emailed link", async ({ page }) => {
    const identity = await registerAndConfirm(page);
    await logOut(page);

    await page.goto("/forgot-password");
    await page.getByLabel("Email", { exact: true }).fill(identity.email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("If an account exists")).toBeVisible();

    await page.goto(await linkFromEmail(identity.email, /Reset your FindMe password/));
    await expect(page).toHaveURL(/\/reset-password$/);

    const newPassword = "a completely new password";
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password").fill(newPassword);
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await logOut(page);

    await logIn(page, identity.email);
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();
    await logIn(page, identity.email, newPassword);
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("the reset page refuses a signed-in user with no recovery link", async ({ page }) => {
    await registerAndConfirm(page);
    await page.goto("/reset-password");
    await expect(page.getByRole("heading", { name: "This link has expired" })).toBeVisible();
    await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
  });

  test("the reset form responds the same for an unknown email", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email", { exact: true }).fill(`nobody-${Date.now()}@example.test`);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("If an account exists")).toBeVisible();
  });
});

test.describe("account settings", () => {
  test("a user can change their name", async ({ page }) => {
    await registerAndConfirm(page);
    await page.goto("/dashboard/settings");
    await page.getByLabel("Name", { exact: true }).fill("New Name");
    await page.getByRole("button", { name: "Save name" }).click();
    await expect(page.getByText("Name updated.")).toBeVisible();
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Welcome, New Name" })).toBeVisible();
  });

  test("a user can change their password, but only with the current one", async ({ page }) => {
    const identity = await registerAndConfirm(page);
    await page.goto("/dashboard/settings");

    const newPassword = "another strong password";
    await page.getByLabel("Current password").fill("this is the wrong one");
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password").fill(newPassword);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("That password isn't correct.")).toBeVisible();

    await page.getByLabel("Current password").fill(PASSWORD);
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password").fill(newPassword);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Password changed.")).toBeVisible();

    await logOut(page);
    await logIn(page, identity.email, newPassword);
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("changing email needs confirmation from both addresses", async ({ page }) => {
    const identity = await registerAndConfirm(page);
    const updated = uniqueIdentity("changed");

    await page.goto("/dashboard/settings");
    await page.getByLabel("New email").fill(updated.email);
    await page.getByRole("button", { name: "Change email" }).click();
    await expect(page.getByText("Check your inbox.")).toBeVisible();

    await page.goto(await linkFromEmail(identity.email, /Confirm your new FindMe email/));
    await page.goto(await linkFromEmail(updated.email, /Confirm your new FindMe email/));

    await page.goto("/dashboard/settings");
    await expect(page.getByText(updated.email)).toBeVisible();
    await logOut(page);
    await logIn(page, updated.email);
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test.describe("public surface", () => {
  test("the home page leads to registration", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Your entire world. One link." })).toBeVisible();
    await page.getByRole("link", { name: "Create your free page" }).click();
    await expect(page).toHaveURL(/\/register$/);
  });

  test("legal pages are reachable and marked as drafts", async ({ page }) => {
    for (const [path, title] of [["/privacy", "Privacy Policy"], ["/terms", "Terms of Service"]]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
      await expect(page.getByRole("note")).toContainText("Draft");
    }
  });

  test("responses carry security headers and hide the framework", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("the health endpoint reports the database", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", database: "ok" });
  });

  test("the username API validates input", async ({ request }) => {
    const reserved = await request.get("/api/usernames/check?username=admin");
    expect(await reserved.json()).toMatchObject({ available: false, reason: "invalid" });
    const free = await request.get(`/api/usernames/check?username=free${Date.now()}`);
    expect(await free.json()).toMatchObject({ available: true });
  });
});
