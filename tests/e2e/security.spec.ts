import { expect, test } from "@playwright/test";
import {
  ANON_KEY,
  linkFromEmail,
  logIn,
  PASSWORD,
  registerAndConfirm,
  resetRateLimits,
  serviceRest,
  SUPABASE_URL,
  uniqueIdentity,
} from "./helpers";

/**
 * These bypass the app and call real Supabase directly with the public anon key,
 * which is exactly what an attacker can do. They check the real grants and policies,
 * complementing the in-process database tests.
 */
async function rest(path: string, token: string = ANON_KEY, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init.headers,
    },
  });
}

async function accessToken(email: string, password = PASSWORD): Promise<string> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  expect(response.ok).toBe(true);
  return (await response.json()).access_token;
}

test.beforeEach(resetRateLimits);

test.describe("direct API access with the public key", () => {
  test("anonymous callers cannot reach private tables or functions", async () => {
    for (const table of ["profiles", "accounts", "admin_roles", "audit_logs", "reserved_usernames", "rate_limit_buckets"]) {
      const response = await rest(`${table}?select=*`);
      expect(response.status, table).toBeGreaterThanOrEqual(400);
    }
    const limiter = await rest("rpc/check_rate_limit", ANON_KEY, {
      method: "POST",
      body: JSON.stringify({ p_key: "x", p_limit: 1, p_window_seconds: 1 }),
    });
    expect(limiter.status).toBeGreaterThanOrEqual(400);
  });

  test("the public view shows no drafts and no owner ids", async ({ page }) => {
    const identity = await registerAndConfirm(page);
    const drafts = await rest(`public_profiles?username=eq.${identity.username}`);
    expect(await drafts.json()).toEqual([]);

    const ownerColumn = await rest("public_profiles?select=owner_id");
    expect(ownerColumn.status).toBeGreaterThanOrEqual(400);
  });

  test("a signed-in user cannot touch another user's data or escalate", async ({ browser }) => {
    const aliceContext = await browser.newContext();
    const bobContext = await browser.newContext();
    const alice = await registerAndConfirm(await aliceContext.newPage());
    const bob = await registerAndConfirm(await bobContext.newPage());
    await aliceContext.close();
    await bobContext.close();

    const aliceToken = await accessToken(alice.email);
    const bobToken = await accessToken(bob.email);

    const [bobProfile] = await (await rest("profiles?select=id,owner_id", bobToken)).json();
    const [aliceProfile] = await (await rest("profiles?select=id,owner_id", aliceToken)).json();
    expect(aliceProfile.id).not.toBe(bobProfile.id);

    const read = await rest(`profiles?id=eq.${bobProfile.id}`, aliceToken);
    expect(await read.json()).toEqual([]);

    const edit = await rest(`profiles?id=eq.${bobProfile.id}`, aliceToken, {
      method: "PATCH",
      body: JSON.stringify({ bio: "hacked" }),
    });
    expect(await edit.json()).toEqual([]);

    const removal = await rest(`profiles?id=eq.${bobProfile.id}`, aliceToken, { method: "DELETE" });
    expect(await removal.json()).toEqual([]);

    const forgedStatus = await rest(`accounts?id=eq.${aliceProfile.owner_id}`, aliceToken, {
      method: "PATCH",
      body: JSON.stringify({ terms_accepted_version: "forged" }),
    });
    expect(forgedStatus.status).toBeGreaterThanOrEqual(400);

    const selfAdmin = await rest("admin_roles", aliceToken, {
      method: "POST",
      body: JSON.stringify({ user_id: aliceProfile.owner_id, role: "admin" }),
    });
    expect(selfAdmin.status).toBeGreaterThanOrEqual(400);

    const isAdmin = await rest("rpc/is_admin", aliceToken, { method: "POST", body: "{}" });
    expect(await isAdmin.json()).toBe(false);

    const secondProfile = await rest("profiles", aliceToken, {
      method: "POST",
      body: JSON.stringify({ owner_id: aliceProfile.owner_id, username: `${alice.username}x`, display_name: "x" }),
    });
    expect(secondProfile.status).toBeGreaterThanOrEqual(400);
  });

  test("signing up directly with a reserved username creates no profile", async ({ page }) => {
    const identity = uniqueIdentity();
    const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: identity.email, password: PASSWORD, data: { username: "admin" } }),
    });
    expect(response.ok).toBe(true);

    // Accepted without a username or consent, so onboarding must collect both before the dashboard.
    await page.goto(await linkFromEmail(identity.email, /Confirm your FindMe email/));
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole("heading", { name: "Claim your link" })).toBeVisible();
  });
});

test.describe("onboarding", () => {
  test("an account with no username or consent must finish onboarding", async ({ page }) => {
    const identity = uniqueIdentity();
    await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: identity.email, password: PASSWORD, data: { full_name: "Google Style" } }),
    });
    await page.goto(await linkFromEmail(identity.email, /Confirm your FindMe email/));
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByLabel("Display name")).toHaveValue("Google Style");

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/onboarding$/);

    await page.getByLabel("Username", { exact: true }).fill(identity.username);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Please accept the Terms and Privacy Policy")).toBeVisible();

    await page.getByLabel(/I agree to the/).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Welcome, Google Style" })).toBeVisible();
  });
});

test.describe("suspension", () => {
  test("a suspended account is locked out and its status can't be undone by the user", async ({ page }) => {
    const identity = await registerAndConfirm(page);
    const token = await accessToken(identity.email);
    const [{ owner_id: ownerId }] = await (await rest("profiles?select=owner_id", token)).json();

    const suspended = await serviceRest(`accounts?id=eq.${ownerId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "suspended" }),
    });
    expect(suspended.ok).toBe(true);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/suspended$/);
    await expect(page.getByRole("heading", { name: "Your account is suspended" })).toBeVisible();

    const restore = await rest(`accounts?id=eq.${ownerId}`, token, {
      method: "PATCH",
      body: JSON.stringify({ status: "active" }),
    });
    expect(restore.status).toBeGreaterThanOrEqual(400);
  });
});

test.describe("rate limiting", () => {
  test("the username API returns 429 with a Retry-After header", async ({ request }) => {
    let limited = null;
    for (let attempt = 0; attempt < 70 && !limited; attempt += 1) {
      const response = await request.get(`/api/usernames/check?username=probe${attempt}`);
      if (response.status() === 429) limited = response;
    }
    expect(limited).not.toBeNull();
    expect(Number(limited?.headers()["retry-after"])).toBeGreaterThan(0);
  });

  test("repeated failed logins are stopped, even with the right password", async ({ page }) => {
    const identity = await registerAndConfirm(page);
    await page.context().clearCookies();

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await logIn(page, identity.email, "not the right password");
      await expect(page.getByText("Incorrect email or password.")).toBeVisible();
    }
    await logIn(page, identity.email);
    await expect(page.getByText(/Too many attempts/)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
