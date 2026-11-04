import { expect, type Page, test } from "@playwright/test";
import { Buffer } from "node:buffer";
import { crc32, deflateSync } from "node:zlib";
import {
  ANON_KEY,
  fillRegistration,
  linkFromEmail,
  PASSWORD,
  registerAndConfirm,
  resetRateLimits,
  serviceRest,
  SUPABASE_URL,
  uniqueIdentity,
} from "./helpers";

/** Builds a real 32x32 violet PNG, so uploads and the image pipeline are tested with valid bytes. */
function createPng(): Buffer {
  const size = 32;
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([length, body, checksum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // 8 bits per channel
  header[9] = 2; // RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3, Buffer.from([0x76, 0x57, 0xf6]))]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(new Array(size).fill(row)))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const PNG = createPng();

test.beforeEach(resetRateLimits);

async function publish(page: Page) {
  await page.goto("/dashboard/my-page");
  await page.getByRole("button", { name: "Publish page" }).click();
  await expect(page.getByTestId("publish-status")).toHaveText("Published");
}

async function addLink(page: Page, title: string, url: string) {
  await page.getByRole("button", { name: "Add block" }).click();
  await page.getByRole("button", { name: /^Link A button/ }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Web address").fill(url);
  await page.getByRole("button", { name: "Add link" }).click();
  await expect(page.getByText(new RegExp(`^${title} ·`))).toBeVisible();
}

async function addBlock(page: Page, typeName: RegExp, fields: Record<string, string>, submit: string) {
  await page.getByRole("button", { name: "Add block" }).click();
  await page.getByRole("button", { name: typeName }).click();
  for (const [label, value] of Object.entries(fields)) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  await page.getByRole("button", { name: submit }).click();
  await expect(page.getByRole("button", { name: "Add block" })).toBeVisible();
}

test.describe("onboarding wizard", () => {
  test("walks through every step, with progress, and publishes", async ({ page }) => {
    const identity = uniqueIdentity();
    await fillRegistration(page, identity);
    await page.getByRole("button", { name: "Create your free page" }).click();
    await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
    await page.goto(await linkFromEmail(identity.email, /Confirm your FindMe email/));

    await expect(page.getByRole("heading", { name: "Welcome to FindMe" })).toBeVisible();
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "10");
    await page.getByRole("button", { name: "Get started" }).click();

    await expect(page.getByRole("heading", { name: "Choose your username" })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "Add a profile picture" })).toBeVisible();
    await page.getByLabel("Profile picture").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByRole("button", { name: "Replace" })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "What should we call you?" })).toBeVisible();
    await page.getByLabel("Display name").fill("Wizard Person");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "Write a short bio" })).toBeVisible();
    await page.getByLabel("Bio").fill("Hello from the wizard");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "What best describes you?" })).toBeVisible();
    await page.getByRole("button", { name: "Skip" }).click();

    await expect(page.getByRole("heading", { name: "Add your social links" })).toBeVisible();
    await page.getByLabel("Platform").selectOption("github");
    await page.getByLabel("Link").fill("github.com/wizard");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("https://github.com/wizard")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "Choose a theme" })).toBeVisible();
    await page.getByRole("radio", { name: "Dark" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "Here's your page" })).toBeVisible();
    await expect(page.getByTestId("live-preview").getByRole("heading", { name: "Wizard Person" })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "Ready to go live?" })).toBeVisible();
    await page.getByRole("button", { name: "Publish my page" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto(`/${identity.username}`);
    await expect(page.getByRole("heading", { name: "Wizard Person", level: 1 })).toBeVisible();
    await expect(page.getByText("Hello from the wizard")).toBeVisible();
    await expect(page.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", "https://github.com/wizard");
    await expect(page.locator(".fm-page")).toHaveCSS("background-color", "rgb(11, 15, 25)");

    // Finished people aren't sent through it again.
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test.describe("publishing", () => {
  test("a page is visible only while published", async ({ page, browser }) => {
    const identity = await registerAndConfirm(page);
    const visitor = await (await browser.newContext()).newPage();

    const draft = await visitor.goto(`/${identity.username}`);
    expect(draft?.status()).toBe(404);

    await publish(page);
    const live = await visitor.goto(`/${identity.username}`);
    expect(live?.status()).toBe(200);
    await expect(visitor.getByRole("heading", { name: identity.name })).toBeVisible();

    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByTestId("publish-status")).toHaveText("Unpublished");
    const hidden = await visitor.goto(`/${identity.username}`);
    expect(hidden?.status()).toBe(404);
    await visitor.context().close();
  });

  test("usernames resolve in any case, and metadata is present", async ({ page, request }) => {
    const identity = await registerAndConfirm(page);
    await publish(page);

    await page.goto(`/${identity.username.toUpperCase()}`);
    await expect(page).toHaveURL(new RegExp(`/${identity.username}$`));

    await expect(page).toHaveTitle(new RegExp(identity.name));
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", new RegExp(identity.name));
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/${identity.username}$`));
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /^index/);

    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/features");
  });

  test("turning off search listing asks engines to stay away", async ({ page }) => {
    const identity = await registerAndConfirm(page);
    await publish(page);
    await page.getByLabel(/Allow search engines/).uncheck();
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    await page.goto(`/${identity.username}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("private areas are excluded from robots and unknown names are 404", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /dashboard");
    expect((await request.get("/no-such-user-here")).status()).toBe(404);
    expect((await request.get("/has%20space")).status()).toBe(404);
  });
});

test.describe("link manager", () => {
  test("adds, edits, duplicates, hides and deletes, updating the live page", async ({ page, browser }) => {
    const identity = await registerAndConfirm(page);
    await publish(page);
    await page.goto("/dashboard/links");
    await addLink(page, "First link", "example.com/first");
    await expect(page.getByTestId("live-preview").getByRole("link", { name: "First link" })).toBeVisible();

    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(`/${identity.username}`);
    const publicLink = visitor.getByRole("link", { name: "First link" });
    await expect(publicLink).toHaveAttribute("href", /^\/l\/[0-9a-f-]{36}$/);
    const redirect = await visitor.request.get((await publicLink.getAttribute("href"))!, { maxRedirects: 0 });
    expect(redirect.status()).toBe(302);
    expect(redirect.headers().location).toBe("https://example.com/first");
    await expect(publicLink).toHaveAttribute("rel", /noopener/);
    await expect(publicLink).toHaveAttribute("target", "_blank");

    await page.getByRole("button", { name: "Edit Link" }).click();
    await page.getByLabel("Title").fill("Renamed link");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/^Renamed link ·/)).toBeVisible();

    await page.getByRole("button", { name: "Duplicate Link" }).click();
    await expect(page.getByText(/^Renamed link ·/)).toHaveCount(2);

    await page.getByRole("button", { name: "Hide Link" }).first().click();
    await expect(page.getByText("Hidden", { exact: true })).toBeVisible();
    await visitor.waitForTimeout(300);
    await visitor.reload();
    await expect(visitor.getByRole("link", { name: "Renamed link" })).toHaveCount(1);

    page.on("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Delete Link" }).first().click();
    await expect(page.getByText(/^Renamed link ·/)).toHaveCount(1);

    await visitor.context().close();
  });

  test("refuses dangerous URLs", async ({ page }) => {
    await registerAndConfirm(page);
    await page.goto("/dashboard/links");
    await page.getByRole("button", { name: "Add block" }).click();
    await page.getByRole("button", { name: /^Link A button/ }).click();
    await page.getByLabel("Title").fill("Bad");
    for (const url of ["javascript:alert(1)", "data:text/html,x", "http://localhost/"]) {
      await page.getByLabel("Web address").fill(url);
      await page.getByRole("button", { name: "Add link" }).click();
      await expect(page.getByText("Enter a valid web address")).toBeVisible();
    }
  });

  test("reorders by drag and by keyboard, and the order persists", async ({ page, browser }) => {
    const identity = await registerAndConfirm(page);
    await publish(page);
    await page.goto("/dashboard/links");
    await addLink(page, "Alpha", "example.com/a");
    await addLink(page, "Bravo", "example.com/b");
    await addLink(page, "Charlie", "example.com/c");

    const handles = page.getByRole("button", { name: "Reorder Link" });
    const from = await handles.nth(2).boundingBox();
    const to = await handles.nth(0).boundingBox();
    await page.mouse.move(from!.x + 10, from!.y + 10);
    await page.mouse.down();
    await page.mouse.move(from!.x + 10, from!.y - 20, { steps: 5 });
    await page.mouse.move(to!.x + 10, to!.y + 5, { steps: 10 });
    await page.mouse.up();

    const titles = () => page.locator("ul li p.truncate").allTextContents();
    await expect.poll(async () => (await titles()).map((text) => text.split(" ·")[0])).toEqual(["Charlie", "Alpha", "Bravo"]);

    // Lets the drag's settling animation finish, because keyboard moves measure positions on screen.
    await page.waitForTimeout(800);
    await handles.nth(1).focus();
    await page.keyboard.press("Space");
    await page.waitForTimeout(150);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(150);
    await page.keyboard.press("Space");
    await expect.poll(async () => (await titles()).map((text) => text.split(" ·")[0])).toEqual(["Charlie", "Bravo", "Alpha"]);

    // Reloads until the save has landed, then proves the order came from the database.
    await expect(async () => {
      await page.reload();
      await expect.poll(async () => (await titles()).map((text) => text.split(" ·")[0])).toEqual(["Charlie", "Bravo", "Alpha"]);
    }).toPass({ timeout: 20_000 });

    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(`/${identity.username}`);
    const names = await visitor.locator(".fm-button-body").allTextContents();
    expect(names).toEqual(["Charlie", "Bravo", "Alpha"]);
    await visitor.context().close();
  });

  test("rolls back a reorder the server refuses", async ({ page }) => {
    await registerAndConfirm(page);
    await page.goto("/dashboard/links");
    await addLink(page, "Alpha", "example.com/a");
    await addLink(page, "Bravo", "example.com/b");

    // Another tab deletes a block, so this tab's list is now out of date.
    const [{ id }] = await (await serviceRest("blocks?select=id&order=created_at.desc&limit=1")).json();
    await serviceRest(`blocks?id=eq.${id}`, { method: "DELETE" });

    const handles = page.getByRole("button", { name: "Reorder Link" });
    await handles.nth(1).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Space");

    await expect(page.getByRole("alert").filter({ hasText: "changed somewhere else" })).toBeVisible();
    const titles = await page.locator("ul li p.truncate").allTextContents();
    expect(titles.map((text) => text.split(" ·")[0])).toEqual(["Alpha", "Bravo"]);
  });

  test("schedules a link, hiding it from visitors until its time", async ({ page, browser }) => {
    const identity = await registerAndConfirm(page);
    await publish(page);
    await page.goto("/dashboard/links");

    await page.getByRole("button", { name: "Add block" }).click();
    await page.getByRole("button", { name: /^Link A button/ }).click();
    await page.getByLabel("Title").fill("Future link");
    await page.getByLabel("Web address").fill("example.com/soon");
    await page.getByText("Schedule").click();
    await page.getByLabel("Show from").fill("2099-01-01T10:00");
    await page.getByRole("button", { name: "Add link" }).click();
    await expect(page.getByText("Scheduled", { exact: true })).toBeVisible();

    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(`/${identity.username}`);
    await expect(visitor.getByRole("heading", { name: identity.name })).toBeVisible();
    await expect(visitor.getByRole("link", { name: "Future link" })).toHaveCount(0);
    await visitor.context().close();
  });
});

test.describe("content blocks", () => {
  test("renders each kind of block safely on the public page", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const identity = await registerAndConfirm(page);
    await publish(page);
    await page.goto("/dashboard/my-page");
    await page.getByLabel("Platform").selectOption("github");
    await page.getByLabel("Link", { exact: true }).fill("github.com/someone");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("https://github.com/someone")).toBeVisible();

    await page.goto("/dashboard/links");
    await addBlock(page, /^Heading/, { Heading: "<b>Section</b>" }, "Add heading");
    await addBlock(page, /^Text A paragraph/, { Text: "<script>window.hacked=1</script>Plain words" }, "Add text");
    await addBlock(page, /^Featured link/, { Title: "Big card", "Web address": "example.com/big" }, "Add featured link");
    await addBlock(page, /^Product card/, { "Product name": "A book", "Where to buy": "example.com/buy", Price: "₹499" }, "Add product card");
    await addBlock(page, /^Announcement/, { Message: "Big news" }, "Add announcement");
    await addBlock(page, /^Email button/, { "Button label": "Email me", "Email address": "me@example.test" }, "Add email button");
    await addBlock(page, /^Phone button/, { "Button label": "Call me", "Phone number": "+91 98765 43210" }, "Add phone button");
    await addBlock(page, /^Contact information/, { Email: "info@example.test" }, "Add contact information");
    await addBlock(page, /^YouTube/, { "YouTube link": "https://youtu.be/dQw4w9WgXcQ" }, "Add youtube");
    await addBlock(page, /^Spotify/, { "Spotify link": "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT" }, "Add spotify");
    await addBlock(page, /^SoundCloud/, { "SoundCloud link": "https://soundcloud.com/artist/track" }, "Add soundcloud");
    await addBlock(page, /^Video Embed/, { "Video link": "https://vimeo.com/123456789" }, "Add video");

    await page.getByRole("button", { name: "Add block" }).click();
    await page.getByRole("button", { name: /^Social icons/ }).click();
    await page.getByRole("button", { name: "Add social icons" }).click();
    await page.getByRole("button", { name: "Add block" }).click();
    await page.getByRole("button", { name: /^Divider/ }).click();
    await page.getByRole("button", { name: "Add divider" }).click();

    await page.getByRole("button", { name: "Add block" }).click();
    await page.getByRole("button", { name: /^Image A photo/ }).click();
    await page.getByLabel("Image", { exact: true }).setInputFiles({ name: "pic.png", mimeType: "image/png", buffer: PNG });
    const uploadStarted = Date.now();
    await expect(page.getByRole("button", { name: "Replace" })).toBeVisible({ timeout: 30_000 });
    console.log(`upload took ${Date.now() - uploadStarted}ms`);
    await page.getByRole("button", { name: "Add image" }).click();
    await expect(page.getByRole("button", { name: "Add block" })).toBeVisible();

    const visitor = await (await browser.newContext()).newPage();
    const errors: string[] = [];
    visitor.on("console", (message) => {
      if (message.type() === "error" && !/youtube|ytimg|spotify|soundcloud|vimeo|scdn|sndcdn/i.test(`${message.text()} ${message.location().url}`)) {
        errors.push(message.text());
      }
    });
    await visitor.goto(`/${identity.username}`);

    await expect(visitor.getByRole("heading", { name: "<b>Section</b>" })).toBeVisible();
    await expect(visitor.getByText("<script>window.hacked=1</script>Plain words")).toBeVisible();
    expect(await visitor.evaluate(() => "hacked" in window)).toBe(false);
    await expect(visitor.getByRole("link", { name: /Big card/ })).toHaveAttribute("href", /^\/l\//);
    await expect(visitor.getByText("₹499")).toBeVisible();
    await expect(visitor.getByText("Big news")).toBeVisible();
    await expect(visitor.getByRole("link", { name: "Email me" })).toHaveAttribute("href", "mailto:me@example.test");
    await expect(visitor.getByRole("link", { name: "Call me" })).toHaveAttribute("href", "tel:+919876543210");
    await expect(visitor.getByRole("link", { name: "info@example.test" })).toBeVisible();
    await expect(visitor.getByRole("navigation", { name: "Social links" }).getByRole("link", { name: "GitHub" })).toBeVisible();
    await expect(visitor.locator(".fm-divider")).toBeVisible();
    await visitor.locator(".fm-image img").scrollIntoViewIfNeeded();
    await expect(visitor.locator(".fm-image img")).toBeVisible();
    await expect.poll(() => visitor.locator(".fm-image img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

    // Video players stay out of the page until someone presses play.
    await expect(visitor.locator('iframe[src*="youtube-nocookie"]')).toHaveCount(0);
    await visitor.getByRole("button", { name: "Play YouTube video" }).click();
    await expect(visitor.locator('iframe[src*="youtube-nocookie.com/embed/dQw4w9WgXcQ"]')).toBeAttached();
    await expect(visitor.locator('iframe[src*="open.spotify.com/embed/track/"]')).toBeAttached();
    await expect(visitor.locator('iframe[src*="w.soundcloud.com/player"]')).toBeAttached();
    await expect(visitor.getByRole("button", { name: "Play Vimeo video" })).toBeVisible();

    expect(errors).toEqual([]);
    await visitor.context().close();
  });

  test("uploads reject files that aren't images, whatever they're called", async ({ page }) => {
    await registerAndConfirm(page);
    await page.goto("/dashboard/my-page");
    // Retried because choosing a file before the page has hydrated is ignored.
    await expect(async () => {
      await page.getByLabel("Profile picture").setInputFiles({
        name: "evil.png",
        mimeType: "image/png",
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
      });
      await expect(page.getByText("Use a PNG, JPEG, WebP or GIF image.")).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 20_000 });
  });
});

test.describe("forms on public pages", () => {
  async function pageWithForms(page: Page) {
    const identity = await registerAndConfirm(page);
    await publish(page);
    await page.goto("/dashboard/links");
    await addBlock(page, /^Newsletter form/, {}, "Add newsletter form");
    await addBlock(page, /^Contact form/, {}, "Add contact form");
    return identity;
  }

  test("collects signups and messages, with consent, for the owner alone", async ({ page, browser }) => {
    const identity = await pageWithForms(page);
    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(`/${identity.username}`);

    const newsletter = visitor.locator(".fm-card").filter({ hasText: "Join my newsletter" });
    await newsletter.getByLabel("Email", { exact: true }).fill("fan@example.test");
    await newsletter.getByRole("button", { name: "Subscribe" }).click();
    await expect(newsletter.getByText("Please tick the box")).toBeVisible();
    await newsletter.getByRole("checkbox").check();
    await newsletter.getByRole("button", { name: "Subscribe" }).click();
    await expect(visitor.getByText("Thanks for subscribing!")).toBeVisible();

    const contact = visitor.locator(".fm-card").filter({ hasText: "Get in touch" });
    await contact.getByLabel("Name").fill("A Visitor");
    await contact.getByLabel("Email", { exact: true }).fill("visitor@example.test");
    await contact.getByLabel("Message").fill("<img src=x onerror=alert(1)> Hello there");
    await contact.getByRole("checkbox").check();
    await contact.getByRole("button", { name: "Send message" }).click();
    await expect(visitor.getByText("Your message has been sent")).toBeVisible();
    await visitor.context().close();

    await page.goto("/dashboard/audience");
    await expect(page.getByText("fan@example.test")).toBeVisible();
    await expect(page.getByText("<img src=x onerror=alert(1)> Hello there")).toBeVisible();
    await expect(page.getByText(/Agreed: .*may email me updates/)).toBeVisible();

    await page.getByRole("button", { name: "Delete fan@example.test" }).click();
    await expect(page.getByText("fan@example.test")).toHaveCount(0);
  });

  test("silently drops submissions that fill the hidden field", async ({ page, browser }) => {
    const identity = await pageWithForms(page);
    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(`/${identity.username}`);
    const newsletter = visitor.locator(".fm-card").filter({ hasText: "Join my newsletter" });
    await newsletter.getByLabel("Email", { exact: true }).fill("bot@example.test");
    await newsletter.getByRole("checkbox").check();
    await newsletter.locator('input[name="website"]').fill("spam");
    await newsletter.getByRole("button", { name: "Subscribe" }).click();
    await expect(visitor.getByText("Thanks!")).toBeVisible();
    await visitor.context().close();

    await page.goto("/dashboard/audience");
    await expect(page.getByText("bot@example.test")).toHaveCount(0);
  });

  test("the marketing contact form stores messages", async ({ page }) => {
    const email = `contact-${Date.now()}@example.test`;
    await page.goto("/contact");
    await page.getByLabel("Name").fill("Someone");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Message").fill("Hello FindMe");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("We'll be in touch")).toBeVisible();

    const rows = await (await serviceRest(`contact_submissions?email=eq.${encodeURIComponent(email)}&select=message`)).json();
    expect(rows).toEqual([{ message: "Hello FindMe" }]);
  });
});

test.describe("appearance editor", () => {
  test("previews live, autosaves, undoes, redoes and resets", async ({ page, browser }) => {
    const identity = await registerAndConfirm(page);
    await publish(page);
    await page.goto("/dashboard/appearance");

    const preview = page.getByTestId("live-preview").locator(".fm-page");
    const status = page.getByTestId("save-status");
    await expect(status).toHaveAttribute("data-state", "saved");

    await page.getByRole("radio", { name: "Dark" }).click();
    await expect(preview).toHaveCSS("background-color", "rgb(11, 15, 25)");
    await expect(status).toHaveAttribute("data-state", "saved", { timeout: 10_000 });

    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(`/${identity.username}`);
    await expect(visitor.locator(".fm-page")).toHaveCSS("background-color", "rgb(11, 15, 25)");

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(preview).not.toHaveCSS("background-color", "rgb(11, 15, 25)");
    await page.getByRole("button", { name: "Redo" }).click();
    await expect(preview).toHaveCSS("background-color", "rgb(11, 15, 25)");

    await page.getByText("Background", { exact: true }).click();
    await page.getByLabel("Colour").fill("#ff0000");
    await expect(preview).toHaveCSS("background-color", "rgb(255, 0, 0)");
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(preview).toHaveCSS("background-color", "rgb(11, 15, 25)");

    await page.getByText("Buttons", { exact: true }).click();
    await page.getByLabel("Shape", { exact: true }).selectOption("pill");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(status).toHaveAttribute("data-state", "saved", { timeout: 10_000 });
    await page.reload();
    await page.getByText("Buttons", { exact: true }).click();
    await expect(page.getByLabel("Shape", { exact: true })).toHaveValue("pill");

    await page.getByRole("button", { name: "Desktop preview" }).click();
    await expect(page.getByTestId("live-preview")).toHaveAttribute("data-device", "desktop");
    await visitor.context().close();
  });

  test("doesn't silently overwrite a change made in another tab", async ({ page, context }) => {
    await registerAndConfirm(page);
    await page.goto("/dashboard/appearance");
    await expect(page.getByTestId("save-status")).toHaveAttribute("data-state", "saved");

    const otherTab = await context.newPage();
    await otherTab.goto("/dashboard/appearance");
    await otherTab.getByRole("radio", { name: "Editorial" }).click();
    await expect(otherTab.getByTestId("save-status")).toHaveAttribute("data-state", "saved", { timeout: 10_000 });
    await otherTab.close();

    await page.getByRole("radio", { name: "Dark" }).click();
    await expect(page.getByTestId("save-status")).toHaveAttribute("data-state", "conflict", { timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Reload latest" })).toBeVisible();

    await page.getByRole("button", { name: "Reload latest" }).click();
    await expect(page.getByRole("radio", { name: "Editorial" })).toHaveAttribute("aria-checked", "true");
  });
});

test.describe("username changes", () => {
  test("moves the page, frees nothing for others, and blocks quick repeats", async ({ page, browser }) => {
    const identity = await registerAndConfirm(page);
    await publish(page);
    const next = uniqueIdentity("renamed").username;

    await page.getByLabel("Username").fill(next);
    await page.getByRole("button", { name: "Change username" }).click();
    await expect(page.getByText("Username updated.")).toBeVisible();

    const visitor = await (await browser.newContext()).newPage();
    expect((await visitor.goto(`/${next}`))?.status()).toBe(200);
    expect((await visitor.goto(`/${identity.username}`))?.status()).toBe(404);
    await visitor.context().close();

    const check = await page.request.get(`/api/usernames/check?username=${identity.username}`);
    expect(await check.json()).toMatchObject({ available: false });

    await page.getByLabel("Username").fill(uniqueIdentity("again").username);
    await page.getByRole("button", { name: "Change username" }).click();
    await expect(page.getByText("You changed your username recently.")).toBeVisible();
  });
});

test.describe("QR codes and sharing", () => {
  test("shows a code, downloads PNG and SVG, and offers sharing links", async ({ page }) => {
    const identity = await registerAndConfirm(page);
    await page.goto("/dashboard/qr");

    const preview = page.getByTestId("qr-preview");
    await expect(preview).toBeVisible();
    await expect(page.getByTestId("profile-url")).toContainText(`/${identity.username}`);

    const png = page.waitForEvent("download");
    await page.getByRole("button", { name: "PNG" }).click();
    expect((await png).suggestedFilename()).toBe(`findme-${identity.username}.png`);

    const svg = page.waitForEvent("download");
    await page.getByRole("button", { name: "SVG" }).click();
    expect((await svg).suggestedFilename()).toBe(`findme-${identity.username}.svg`);

    const before = await preview.getAttribute("src");
    await page.getByLabel("Code colour").fill("#7657f6");
    await expect.poll(() => preview.getAttribute("src")).not.toBe(before);
    expect(decodeURIComponent((await preview.getAttribute("src")) ?? "")).toContain("#7657f6");

    await page.getByLabel("Choose a logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
    await expect.poll(async () => decodeURIComponent((await preview.getAttribute("src")) ?? "")).toContain("<image");
    await page.getByRole("button", { name: "Remove" }).click();

    await expect(page.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\//);
    await expect(page.getByRole("link", { name: "LinkedIn" })).toHaveAttribute("href", /linkedin\.com/);
  });
});

test.describe("dashboard", () => {
  test("every navigation item and quick action opens a working page", async ({ page }) => {
    await registerAndConfirm(page);
    for (const [name, heading] of [
      ["My Page", "My Page"],
      ["Links", "Links"],
      ["Appearance", "Appearance"],
      ["Audience", "Audience"],
      ["QR Code", "QR code and sharing"],
      ["Settings", "Settings"],
      ["Help", "Help"],
    ]) {
      await page.getByRole("navigation", { name: "Dashboard" }).filter({ visible: true }).getByRole("link", { name, exact: true }).click();
      await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
    }

    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Add link" }).click();
    await expect(page.getByRole("heading", { name: "Add a block" })).toBeVisible();

    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Preview" }).click();
    await expect(page.getByTestId("live-preview")).toBeVisible();
  });

  test("works without horizontal scrolling on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await registerAndConfirm(page);
    for (const path of ["/dashboard", "/dashboard/links", "/dashboard/appearance", "/dashboard/my-page", "/dashboard/qr"]) {
      await page.goto(path);
      await expect(page.locator("main h1").first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});

test.describe("marketing site", () => {
  test("every page loads and has no invented claims", async ({ page }) => {
    for (const [path, heading] of [
      ["/", "Your entire world."],
      ["/features", "Everything your page needs"],
      ["/themes", "Find your look"],
      ["/about", "Everything you are, in one link"],
      ["/contact", "Contact us"],
      ["/faq", "Frequently asked questions"],
    ]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: new RegExp(heading) })).toBeVisible();
      await expect(page.locator("body")).not.toContainText(/testimonial|\d[\d,]*\+? (users|creators|customers)/i);
    }
  });

  test("the hero preview switches themes, and Explore examples goes to themes", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Dark" }).click();
    await expect(page.locator(".fm-page").first()).toHaveCSS("background-color", "rgb(11, 15, 25)");
    await page.getByRole("link", { name: "Explore examples" }).click();
    await expect(page).toHaveURL(/\/themes$/);
    // The previous route stays mounted but hidden, so only count what's on screen.
    await expect(page.locator(".fm-page").filter({ visible: true })).toHaveCount(10);
  });

  test("pricing is gone, and phone previews scroll rather than cutting content off", async ({ page, request }) => {
    expect((await request.get("/pricing")).status()).toBe(404);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/themes");
    await expect(page.getByRole("link", { name: "Pricing" })).toHaveCount(0);
    for (const phone of await page.getByTestId("demo-phone").all()) {
      const fits = await phone.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
        const footer = el.querySelector(".fm-footer")!.getBoundingClientRect();
        const box = el.getBoundingClientRect();
        const page = el.querySelector(".fm-page")!.getBoundingClientRect();
        return {
          footerVisible: footer.bottom <= box.bottom + 1,
          centred: Math.abs(page.left - box.left - (box.right - page.right)) <= 1,
          noSideways: el.scrollWidth <= el.clientWidth,
        };
      });
      expect(fits).toEqual({ footerVisible: true, centred: true, noSideways: true });
    }
  });
});

test.describe("direct API access", () => {
  async function accessToken(email: string): Promise<string> {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    return (await response.json()).access_token;
  }

  const rest = (path: string, token: string, init: RequestInit = {}) =>
    fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...init,
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation", ...init.headers },
    });

  test("the database itself refuses unsafe content and other users' data", async ({ browser }) => {
    const aliceContext = await browser.newContext();
    const alice = await registerAndConfirm(await aliceContext.newPage());
    await aliceContext.close();
    const bobContext = await browser.newContext();
    const bob = await registerAndConfirm(await bobContext.newPage());
    await bobContext.close();

    const aliceToken = await accessToken(alice.email);
    const bobToken = await accessToken(bob.email);
    const [{ id: aliceProfile }] = await (await rest("profiles?select=id", aliceToken)).json();
    const [{ id: bobProfile }] = await (await rest("profiles?select=id", bobToken)).json();

    const body = (profile: string, url: string) => JSON.stringify({ profile_id: profile, type: "link", config: { title: "x", url } });

    expect((await rest("blocks", aliceToken, { method: "POST", body: body(aliceProfile, "javascript:alert(1)") })).status).toBeGreaterThanOrEqual(400);
    expect((await rest("blocks", aliceToken, { method: "POST", body: body(bobProfile, "https://example.com") })).status).toBeGreaterThanOrEqual(400);

    const leads = await rest("leads", ANON_KEY, {
      method: "POST",
      body: JSON.stringify({ profile_id: bobProfile, kind: "newsletter", email: "a@b.co", consent_text: "x" }),
    });
    expect(leads.status).toBeGreaterThanOrEqual(400);
    expect((await rest("leads?select=*", ANON_KEY)).status).toBeGreaterThanOrEqual(400);
    expect(await (await rest(`leads?profile_id=eq.${bobProfile}`, aliceToken)).json()).toEqual([]);

    const reorder = await rest("rpc/reorder_blocks", aliceToken, {
      method: "POST",
      body: JSON.stringify({ p_profile_id: bobProfile, p_ids: [] }),
    });
    expect(reorder.status).toBeGreaterThanOrEqual(400);

    const upload = await fetch(`${SUPABASE_URL}/storage/v1/object/profile-media/${crypto.randomUUID()}/x.png`, {
      method: "POST",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${aliceToken}`, "Content-Type": "image/png" },
      body: new Uint8Array(PNG),
    });
    expect(upload.status).toBeGreaterThanOrEqual(400);

    const svg = await fetch(`${SUPABASE_URL}/storage/v1/object/profile-media/${(JSON.parse(atob(aliceToken.split(".")[1])) as { sub: string }).sub}/x.svg`, {
      method: "POST",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${aliceToken}`, "Content-Type": "image/svg+xml" },
      body: "<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>",
    });
    expect(svg.status).toBeGreaterThanOrEqual(400);
  });

  test("a suspended account can't write, even directly", async ({ page }) => {
    const identity = await registerAndConfirm(page);
    const token = await accessToken(identity.email);
    const [{ id, owner_id: ownerId }] = await (await rest("profiles?select=id,owner_id", token)).json();
    await serviceRest(`accounts?id=eq.${ownerId}`, { method: "PATCH", body: JSON.stringify({ status: "suspended" }) });

    const edit = await rest(`profiles?id=eq.${id}`, token, { method: "PATCH", body: JSON.stringify({ bio: "x" }) });
    expect(await edit.json()).toEqual([]);
    const add = await rest("blocks", token, { method: "POST", body: JSON.stringify({ profile_id: id, type: "divider" }) });
    expect(add.status).toBeGreaterThanOrEqual(400);
  });
});

