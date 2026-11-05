import { Buffer } from "node:buffer";
import { expect, type Page, test } from "@playwright/test";
import { registerAndConfirm, resetRateLimits, serviceRest, uniqueIdentity } from "./helpers";

test.beforeEach(resetRateLimits);

async function publish(page: Page) {
  await page.goto("/dashboard/my-page");
  await page.getByRole("button", { name: "Publish page" }).click();
  await expect(page.getByTestId("publish-status")).toHaveText("Published");
}

async function addSocial(page: Page, platform: string, url: string) {
  await page.getByLabel("Platform").selectOption(platform);
  await page.getByLabel(/^(Link|Email address)$/).fill(url);
  await page.getByRole("button", { name: "Add", exact: true }).click();
}

async function buttonsFor(username: string) {
  const [{ id }] = await (await serviceRest(`profiles?username=eq.${username}&select=id`)).json();
  return (await serviceRest(`blocks?profile_id=eq.${id}&type=in.(link,email_button)&select=type,config,is_visible`)).json();
}

test.describe("social links become buttons", () => {
  test("adding, editing, hiding and removing a link all reach its button", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const identity = await registerAndConfirm(page);
    await publish(page);

    await addSocial(page, "instagram", "instagram.com/asha");
    await expect(page.getByRole("status").filter({ hasText: "Instagram now has its own button" })).toBeVisible();
    await addSocial(page, "email", "asha@example.test");
    await expect(page.getByRole("status").filter({ hasText: "Email now has its own button" })).toBeVisible();

    const visitorContext = await browser.newContext();
    const visitor = await visitorContext.newPage();
    await visitor.goto(`/${identity.username}`);
    await expect(visitor.getByRole("navigation", { name: "Social links" }).getByRole("link", { name: "Instagram" })).toBeVisible();
    const button = visitor.locator(".fm-button", { hasText: "Instagram" });
    await expect(button).toBeVisible();
    await expect(button.locator("svg")).toBeVisible();
    await expect(visitor.locator(".fm-button", { hasText: "Email me" })).toBeVisible();

    // The creator can rename it, and it still shows up as theirs.
    await page.goto("/dashboard/links");
    await page.getByRole("button", { name: /Edit/ }).first().click();
    await page.getByLabel("Title").fill("Follow me on Insta");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/^Follow me on Insta /)).toBeVisible();

    await expect(async () => {
      await visitor.goto(`/${identity.username}`);
      await expect(visitor.locator(".fm-button", { hasText: "Follow me on Insta" }).locator("svg")).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20_000 });

    // Hiding the icon hides the renamed button too.
    await page.goto("/dashboard/my-page");
    await page.getByRole("button", { name: "Hide Instagram" }).click();
    await expect.poll(async () => (await buttonsFor(identity.username)).find((b: { type: string }) => b.type === "link")?.is_visible).toBe(false);

    // Asking for missing buttons doesn't create a duplicate.
    await page.getByRole("button", { name: "Add buttons for my links" }).click();
    await expect(page.getByRole("status").filter({ hasText: "All your links already have buttons" })).toBeVisible();
    expect(await buttonsFor(identity.username)).toHaveLength(2);

    // Removing the link takes the button away, wherever it had been renamed.
    await page.getByRole("button", { name: "Remove Instagram" }).click();
    await expect.poll(async () => (await buttonsFor(identity.username)).filter((b: { type: string }) => b.type === "link")).toHaveLength(0);
    await visitorContext.close();
  });

  test("a button pointed somewhere else loses the platform's logo and is left alone", async ({ page }) => {
    const identity = await registerAndConfirm(page);
    await publish(page);
    await addSocial(page, "instagram", "instagram.com/asha");
    await expect(page.getByRole("status").filter({ hasText: "Instagram now has its own button" })).toBeVisible();

    await page.goto("/dashboard/links");
    await page.getByRole("button", { name: /Edit/ }).first().click();
    await page.getByLabel("Web address").fill("example.com/not-instagram");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: "Add block" })).toBeVisible();

    await expect(async () => {
      await page.goto(`/${identity.username}`);
      const button = page.locator(".fm-button", { hasText: "Instagram" });
      await expect(button).toBeVisible({ timeout: 2000 });
      await expect(button.locator("svg")).toHaveCount(0, { timeout: 2000 });
    }).toPass({ timeout: 20_000 });

    await page.goto("/dashboard/my-page");
    await page.getByRole("button", { name: "Remove Instagram" }).click();
    await expect.poll(async () => (await buttonsFor(identity.username)).length).toBe(1);
  });
});

test.describe("uploaded photos", () => {
  test("hidden location data is removed, the rotation is kept, and the photo still opens", async ({ page }) => {
    await registerAndConfirm(page);

    // A real JPEG from the browser's own encoder, 40 wide by 20 high.
    await page.goto("/dashboard/my-page");
    const dataUrl = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 40;
      canvas.height = 20;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#7657f6";
      context.fillRect(0, 0, 40, 20);
      return canvas.toDataURL("image/jpeg");
    });
    const jpeg = Buffer.from(dataUrl.split(",")[1], "base64");

    // An Exif block with the rotation "turn 90 degrees", followed by what a phone's GPS would add.
    const secret = "GPS 19.0760 72.8777";
    const tiff = Buffer.from([0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0, 0, 0, 0, 0]);
    const payload = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff, Buffer.from(secret)]);
    const length = Buffer.alloc(2);
    length.writeUInt16BE(payload.length + 2);
    const photo = Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, 0xe1]), length, payload, jpeg.subarray(2)]);
    expect(photo.includes(secret)).toBe(true);

    await page.waitForLoadState("networkidle");
    await page.getByLabel("Profile picture").setInputFiles({ name: "holiday.jpg", mimeType: "image/jpeg", buffer: photo });
    await expect(page.getByRole("button", { name: "Replace" })).toBeVisible({ timeout: 20_000 });
    const preview = page.locator('img[src*="profile-media"]').first();

    const encoded = (await preview.getAttribute("src"))!;
    const storedUrl = encoded.includes("url=") ? decodeURIComponent(new URL(encoded, "http://x").searchParams.get("url")!) : encoded;
    const stored = Buffer.from(await (await fetch(storedUrl)).arrayBuffer());
    expect(stored.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(stored.includes(secret)).toBe(false);
    expect(stored.includes("Exif")).toBe(true);

    // Decoded by a real browser: it opens, and turned 90 degrees it's now taller than it's wide.
    const size = await page.evaluate(async (base64) => {
      const image = new Image();
      image.src = `data:image/jpeg;base64,${base64}`;
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight };
    }, stored.toString("base64"));
    expect(size).toEqual({ width: 20, height: 40 });
  });
});

test.describe("signing up", () => {
  test("the confirmation screen explains what to do when no email arrives", async ({ page }) => {
    const identity = uniqueIdentity();
    await page.goto("/register");
    await page.getByLabel("Name", { exact: true }).fill(identity.name);
    await page.getByLabel("Email", { exact: true }).fill(identity.email);
    await page.getByLabel("Username", { exact: true }).fill(identity.username);
    await page.getByLabel("Password", { exact: true }).fill("correct horse battery");
    await page.getByLabel(/I agree to the/).check();
    await page.getByRole("button", { name: "Create your free page" }).click();
    await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
    await expect(page.getByText("Check your spam folder too")).toBeVisible();
    await expect(page.getByRole("link", { name: "reset your password" })).toHaveAttribute("href", "/forgot-password");
  });
});

test.describe("the landing page", () => {
  test("says clearly that FindMe is free", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Completely free for everyone")).toBeVisible();
    await expect(page.getByText("No card, no trial, no paid plans")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Completely free. Everything included." })).toBeVisible();
  });
});
