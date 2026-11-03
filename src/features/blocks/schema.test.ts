import { describe, expect, it } from "vitest";
import { BLOCK_SCHEMAS, BLOCK_TYPES, blockScheduleSchema, isBlockType, parseBlockConfig, toRenderableBlock } from "./schema";

const path = "11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.png";

const VALID: Record<keyof typeof BLOCK_SCHEMAS, unknown> = {
  link: { title: "My site", url: "example.com" },
  featured_link: { title: "Featured", url: "https://example.com", description: "Look" },
  social_icons: {},
  heading: { text: "Hello" },
  text: { text: "Some words" },
  image: { path, alt: "A photo" },
  youtube: { url: "https://youtu.be/dQw4w9WgXcQ" },
  video: { url: "https://vimeo.com/123456789" },
  spotify: { url: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT" },
  soundcloud: { url: "https://soundcloud.com/artist/track" },
  contact_info: { email: "hi@example.com" },
  email_button: { label: "Email me", email: "hi@example.com" },
  phone_button: { label: "Call me", phone: "+91 98765 43210" },
  divider: {},
  announcement: { text: "News" },
  product_card: { title: "Thing", url: "https://example.com/thing", price: "₹499" },
  newsletter: { heading: "Join", buttonLabel: "Subscribe" },
  contact_form: { heading: "Say hi", buttonLabel: "Send" },
};

describe("block schemas", () => {
  it("covers all 18 block types in the spec", () => {
    expect(BLOCK_TYPES).toHaveLength(18);
  });

  it.each(BLOCK_TYPES)("accepts a valid %s", (type) => {
    expect(parseBlockConfig(type, VALID[type]).success).toBe(true);
  });

  it("normalises link URLs", () => {
    const parsed = parseBlockConfig("link", VALID.link);
    expect(parsed.data).toMatchObject({ url: "https://example.com/" });
  });

  it("strips unknown keys, so nothing unexpected reaches the renderer", () => {
    const parsed = parseBlockConfig("heading", { text: "Hi", onClick: "alert(1)", html: "<script>" });
    expect(parsed.data).toEqual({ text: "Hi" });
  });

  it.each([
    ["link", { title: "x", url: "javascript:alert(1)" }],
    ["link", { title: "", url: "https://example.com" }],
    ["featured_link", { title: "x", url: "data:text/html,x" }],
    ["image", { path: "https://evil.example/x.png" }],
    ["image", { path, linkUrl: "javascript:alert(1)" }],
    ["youtube", { url: "https://evil.example/watch?v=dQw4w9WgXcQ" }],
    ["video", { url: "https://evil.example/video.mp4" }],
    ["spotify", { url: "https://evil.example/track/x" }],
    ["soundcloud", { url: "https://evil.example/a/b" }],
    ["contact_info", {}],
    ["contact_info", { email: "nope" }],
    ["email_button", { label: "x", email: "a@b.co?bcc=evil@example.test" }],
    ["phone_button", { label: "x", phone: "javascript:alert(1)" }],
    ["announcement", { text: "x", url: "javascript:alert(1)" }],
    ["product_card", { title: "x", url: "vbscript:x" }],
    ["text", { text: "a".repeat(2001) }],
  ] as const)("rejects an invalid %s: %j", (type, config) => {
    expect(parseBlockConfig(type, config).success).toBe(false);
  });
});

describe("isBlockType", () => {
  it("does not treat inherited object keys as types", () => {
    expect(isBlockType("link")).toBe(true);
    expect(isBlockType("constructor")).toBe(false);
    expect(isBlockType("__proto__")).toBe(false);
  });
});

describe("toRenderableBlock", () => {
  it("returns valid rows", () => {
    expect(toRenderableBlock({ id: "1", type: "heading", config: { text: "Hi" } })).toEqual({
      id: "1",
      type: "heading",
      config: { text: "Hi" },
    });
  });

  it("drops a row that was stored before a rule tightened, or written directly", () => {
    expect(toRenderableBlock({ id: "1", type: "link", config: { title: "x", url: "javascript:alert(1)" } })).toBeNull();
    expect(toRenderableBlock({ id: "1", type: "unknown", config: {} })).toBeNull();
    expect(toRenderableBlock({ id: "1", type: "heading", config: null })).toBeNull();
  });
});

describe("blockScheduleSchema", () => {
  it("accepts open-ended and ordered schedules", () => {
    expect(blockScheduleSchema.safeParse({}).success).toBe(true);
    expect(blockScheduleSchema.safeParse({ startsAt: "2030-01-01T00:00:00+05:30" }).success).toBe(true);
    expect(blockScheduleSchema.safeParse({ startsAt: "2030-01-01T00:00:00Z", endsAt: "2030-01-02T00:00:00Z" }).success).toBe(true);
  });

  it("rejects a schedule that ends before it starts", () => {
    const result = blockScheduleSchema.safeParse({ startsAt: "2030-01-02T00:00:00Z", endsAt: "2030-01-01T00:00:00Z" });
    expect(result.error?.issues[0].path).toEqual(["endsAt"]);
  });
});
