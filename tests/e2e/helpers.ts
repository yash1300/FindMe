import { expect, type Page } from "@playwright/test";

const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";

process.loadEnvFile(".env.local");
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const PASSWORD = "correct horse battery";

if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(SUPABASE_URL)) {
  throw new Error("E2E tests create and modify data, so they only run against a local Supabase stack.");
}

/** Calls PostgREST with the service role. Test setup only. */
export function serviceRest(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

/** The suite registers far more users than a real client would, so each test starts with clean counters. */
export async function resetRateLimits() {
  const response = await serviceRest("rate_limit_buckets?bucket_key=neq.__none__", { method: "DELETE" });
  if (!response.ok) throw new Error(`Could not reset rate limits: ${response.status}`);
}

export function uniqueIdentity(prefix = "e2e") {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const username = `${prefix}${suffix}`;
  return { username, email: `${username}@example.test`, name: "Asha Rao" };
}

type MailSummary = { ID: string; Subject: string; To: { Address: string }[] };

/** Polls the local inbox and returns the FindMe link from the newest matching email. */
export async function linkFromEmail(email: string, subject: RegExp): Promise<string> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const list = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const { messages } = (await list.json()) as { messages: MailSummary[] };
    const match = messages?.find((message) => subject.test(message.Subject));
    if (match) {
      const detail = await fetch(`${MAILPIT_URL}/api/v1/message/${match.ID}`);
      const { HTML } = (await detail.json()) as { HTML: string };
      const href = HTML.match(/href="([^"]+)"/)?.[1];
      if (!href) throw new Error(`No link in email: ${match.Subject}`);
      return href.replaceAll("&amp;", "&");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No email matching ${subject} for ${email}`);
}

export async function fillRegistration(page: Page, identity: ReturnType<typeof uniqueIdentity>) {
  await page.goto("/register");
  await page.getByLabel("Name", { exact: true }).fill(identity.name);
  await page.getByLabel("Email", { exact: true }).fill(identity.email);
  await page.getByLabel("Username", { exact: true }).fill(identity.username);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel(/I agree to the/).check();
}

export async function registerAndConfirm(page: Page, identity = uniqueIdentity()) {
  await fillRegistration(page, identity);
  await page.getByRole("button", { name: "Create your free page" }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  await page.goto(await linkFromEmail(identity.email, /Confirm your FindMe email/));
  await finishWizardLater(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  return identity;
}

/** Leaves the onboarding wizard straight away, which every step offers. */
export async function finishWizardLater(page: Page) {
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole("button", { name: "Finish later" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

export async function logIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

export async function logOut(page: Page) {
  await page.getByRole("button", { name: "Log out" }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/$/);
}
