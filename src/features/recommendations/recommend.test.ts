import { describe, expect, it } from "vitest";
import { recommend, type RecommendationInput } from "./recommend";

const NOW = Date.parse("2026-11-06T12:00:00Z");
const block = (id: string, type = "link", extra: Partial<RecommendationInput["blocks"][number]> = {}) => ({
  id,
  type,
  config: { title: `Title ${id}`, url: "https://example.com" },
  is_visible: true,
  starts_at: null,
  ends_at: null,
  ...extra,
});
const complete: RecommendationInput = {
  status: "published",
  bio: "Designer",
  avatarPath: "u/a.webp",
  blocks: [block("icons", "social_icons"), block("a"), block("b"), block("c")],
  socialLinks: [{ is_visible: true }],
  views: 5,
  clicks: 1,
  blockClicks: [],
  now: NOW,
};
const ids = (input: Partial<RecommendationInput>, limit = 10) => recommend({ ...complete, ...input }, limit).map((item) => item.id);

describe("recommend", () => {
  it("has nothing to say about a complete page", () => {
    expect(ids({})).toEqual([]);
  });

  it("asks a new creator to publish first, then fill in the basics", () => {
    expect(ids({ status: "draft", bio: "", avatarPath: null, blocks: [block("icons", "social_icons")], socialLinks: [] })).toEqual([
      "publish",
      "first-link",
      "photo",
      "bio",
      "social",
    ]);
  });

  it("shows only the most important few", () => {
    expect(recommend({ ...complete, status: "draft", bio: "", avatarPath: null, blocks: [], socialLinks: [] })).toHaveLength(4);
  });

  it("says nothing to a suspended page", () => {
    expect(ids({ status: "suspended", bio: "" })).toEqual([]);
  });

  it("notices when social icons are kept off the page", () => {
    expect(ids({ blocks: complete.blocks.filter((item) => item.type !== "social_icons") })).toContain("icons-off");
    expect(ids({ blocks: [block("icons", "social_icons", { is_visible: false }), ...complete.blocks.slice(1)] })).toContain("icons-off");
    expect(ids({ socialLinks: [{ is_visible: false }], blocks: complete.blocks.slice(1) })).not.toContain("icons-off");
  });

  it("points out expired blocks", () => {
    expect(ids({ blocks: [...complete.blocks, block("old", "link", { ends_at: "2026-11-01T00:00:00Z" })] })).toContain("expired");
  });

  it("asks for sharing when a live page had no visits", () => {
    expect(ids({ views: 0, clicks: 0 })).toContain("share");
    expect(ids({ status: "draft", views: 0 })).not.toContain("share");
  });

  it("suggests moving a popular link that sits far down the page", () => {
    const blocks = [block("icons", "social_icons"), block("a"), block("b"), block("c"), block("d")];
    const result = recommend({ ...complete, blocks, views: 50, clicks: 10, blockClicks: [{ blockId: "d", clicks: 8 }] });
    expect(result.find((item) => item.id === "move-top-link")?.title).toBe('Move "Title d" up');
  });

  it("waits for enough visits before judging clicks", () => {
    expect(ids({ views: 19, clicks: 0 })).not.toContain("low-clicks");
    expect(ids({ views: 40, clicks: 1 })).toContain("low-clicks");
  });
});
