import { describe, expect, it } from "vitest";
import { parseBlockConfig } from "@/features/blocks/schema";
import { isButtonForSocialLink, pointsAtSocialLink, socialButtonFor } from "./buttons";
import { normalizeSocialUrl, SOCIAL_PLATFORMS } from "./platforms";

describe("socialButtonFor", () => {
  it("makes a valid, named button for every platform", () => {
    for (const { id, label, placeholder } of SOCIAL_PLATFORMS) {
      const url = normalizeSocialUrl(id, placeholder.replace("...", "abc"));
      expect(url, id).not.toBeNull();
      const button = socialButtonFor(id, url!);
      expect(button, id).not.toBeNull();
      if (id === "email") {
        expect(button).toEqual({ type: "email_button", config: { label: "Email me", email: "you@example.com" } });
      } else {
        expect(button?.config).toMatchObject({ title: label, url, platform: id });
      }
    }
  });

  it("stores the same address as the social link, so they can be matched later", () => {
    const url = normalizeSocialUrl("instagram", "instagram.com/asha")!;
    expect(socialButtonFor("instagram", url)?.config).toMatchObject({ url });
  });

  it("returns nothing for an address a button can't hold", () => {
    expect(socialButtonFor("website", "javascript:alert(1)")).toBeNull();
  });
});

describe("matching a button to its social link", () => {
  const url = "https://instagram.com/asha";
  const button = { type: "link", config: { title: "My Insta", url, platform: "instagram" } };

  it("recognises the button after it's been renamed", () => {
    expect(isButtonForSocialLink(button, "instagram", url)).toBe(true);
  });

  it("leaves alone a button pointed somewhere else, or one added by hand", () => {
    expect(isButtonForSocialLink({ ...button, config: { ...button.config, url: "https://example.com" } }, "instagram", url)).toBe(false);
    expect(isButtonForSocialLink({ type: "link", config: { title: "Hand made", url } }, "instagram", url)).toBe(false);
    expect(isButtonForSocialLink({ type: "heading", config: { text: "x" } }, "instagram", url)).toBe(false);
    expect(isButtonForSocialLink({ type: "link", config: null }, "instagram", url)).toBe(false);
  });

  it("matches email buttons whatever the capitalisation", () => {
    const email = { type: "email_button", config: { label: "Write to me", email: "Asha@Example.com" } };
    expect(isButtonForSocialLink(email, "email", "mailto:asha@example.com")).toBe(true);
    expect(isButtonForSocialLink(email, "email", "mailto:other@example.com")).toBe(false);
  });

  it("spots any existing block with the same address, to avoid a duplicate", () => {
    expect(pointsAtSocialLink({ type: "link", config: { title: "Hand made", url } }, url)).toBe(true);
    expect(pointsAtSocialLink({ type: "featured_link", config: { title: "Big", url } }, url)).toBe(true);
    expect(pointsAtSocialLink({ type: "link", config: { title: "Other", url: "https://x.com/a" } }, url)).toBe(false);
  });
});

describe("the link schema's platform field", () => {
  it("accepts a known platform and rejects anything else", () => {
    const base = { title: "x", url: "https://example.com" };
    expect(parseBlockConfig("link", { ...base, platform: "instagram" }).success).toBe(true);
    expect(parseBlockConfig("link", { ...base, platform: "evil" }).success).toBe(false);
  });
});
