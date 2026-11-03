import { describe, expect, it } from "vitest";
import { normalizeSocialUrl, SOCIAL_PLATFORMS, toRenderableSocialLink } from "./platforms";

describe("SOCIAL_PLATFORMS", () => {
  it("covers the 20 platforms in the spec", () => {
    expect(SOCIAL_PLATFORMS).toHaveLength(20);
  });

  it("accepts each platform's own example", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      expect(normalizeSocialUrl(platform.id, platform.placeholder), platform.id).not.toBeNull();
    }
  });
});

describe("normalizeSocialUrl", () => {
  it("adds a scheme", () => {
    expect(normalizeSocialUrl("github", "github.com/yash")).toBe("https://github.com/yash");
  });

  it("accepts subdomains of the platform", () => {
    expect(normalizeSocialUrl("instagram", "https://www.instagram.com/a")).toBe("https://www.instagram.com/a");
    expect(normalizeSocialUrl("spotify", "https://open.spotify.com/artist/x")).toBe("https://open.spotify.com/artist/x");
  });

  it.each([
    ["instagram", "https://evil.example/instagram.com"],
    ["instagram", "https://instagram.com.evil.example/a"],
    ["instagram", "https://notinstagram.com/a"],
    ["x", "https://evil.example"],
    ["github", "javascript:alert(1)"],
    ["website", "javascript:alert(1)"],
    ["website", "data:text/html,x"],
    ["email", "not-an-email"],
    ["email", "a@example.com?bcc=x@evil.example"],
    ["email", "javascript:alert(1)"],
  ] as const)("rejects %s: %s", (platform, input) => {
    expect(normalizeSocialUrl(platform, input)).toBeNull();
  });

  it("stores email as a mailto link", () => {
    expect(normalizeSocialUrl("email", "me@example.com")).toBe("mailto:me@example.com");
    expect(normalizeSocialUrl("email", "mailto:me@example.com")).toBe("mailto:me@example.com");
  });

  it("lets a website link go anywhere public", () => {
    expect(normalizeSocialUrl("website", "my-site.example")).toBe("https://my-site.example/");
  });
});

describe("toRenderableSocialLink", () => {
  it("drops rows that fail validation", () => {
    expect(toRenderableSocialLink({ id: "1", platform: "x", url: "https://evil.example" })).toBeNull();
    expect(toRenderableSocialLink({ id: "1", platform: "myspace", url: "https://myspace.com" })).toBeNull();
    expect(toRenderableSocialLink({ id: "1", platform: "x", url: "https://x.com/a" })?.url).toBe("https://x.com/a");
  });
});
