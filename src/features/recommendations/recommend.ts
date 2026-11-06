import { blockState } from "@/features/blocks/schedule";

export type Recommendation = { id: string; title: string; text: string; href: string; action: string };

type Block = { id: string; type: string; config: Record<string, unknown>; is_visible: boolean; starts_at: string | null; ends_at: string | null };

export type RecommendationInput = {
  status: "draft" | "published" | "unpublished" | "suspended";
  bio: string | null;
  avatarPath: string | null;
  blocks: Block[];
  socialLinks: { is_visible: boolean }[];
  /** The last 30 days. */
  views: number;
  clicks: number;
  /** Clicks per block over the same 30 days, most clicked first. */
  blockClicks: { blockId: string; clicks: number }[];
  now?: number;
};

const LINK_TYPES = new Set(["link", "featured_link", "product_card"]);
/** Enough views for click patterns to mean something, rather than reflect one or two visitors. */
const MEANINGFUL_VIEWS = 20;

const titleOf = (block: Block) => (typeof block.config.title === "string" && block.config.title ? block.config.title : "A link");

/**
 * Practical next steps for a creator, from simple rules about their own page and its numbers.
 * Nothing here is guessed by a model, and nothing leaves the server. Most important first.
 */
export function recommend(input: RecommendationInput, limit = 4): Recommendation[] {
  if (input.status === "suspended") return [];
  const now = input.now ?? Date.now();
  const live = input.blocks.filter((block) => blockState(block, now) === "live");
  const liveLinks = live.filter((block) => LINK_TYPES.has(block.type));
  const out: Recommendation[] = [];

  if (input.status !== "published") {
    out.push({
      id: "publish",
      title: "Publish your page",
      text: "Only you can see it right now. Publish it when you're ready, and share your link.",
      href: "/dashboard/my-page",
      action: "Go to publishing",
    });
  }

  if (liveLinks.length === 0) {
    out.push({ id: "first-link", title: "Add your first link", text: "Point visitors to your best work, shop or latest post.", href: "/dashboard/links?add=1", action: "Add a link" });
  } else if (liveLinks.length < 3) {
    out.push({ id: "more-links", title: "Add a few more links", text: "A handful of clear choices gives visitors a reason to stay.", href: "/dashboard/links?add=1", action: "Add a link" });
  }

  if (!input.avatarPath) {
    out.push({ id: "photo", title: "Add a profile photo", text: "A face or logo helps visitors know they're in the right place.", href: "/dashboard/my-page", action: "Add a photo" });
  }
  if (!input.bio?.trim()) {
    out.push({ id: "bio", title: "Write a short bio", text: "One or two lines on who you are and what you do.", href: "/dashboard/my-page", action: "Write a bio" });
  }

  const visibleSocial = input.socialLinks.filter((link) => link.is_visible).length;
  const iconsBlock = input.blocks.find((block) => block.type === "social_icons");
  if (input.socialLinks.length === 0) {
    out.push({ id: "social", title: "Add your social links", text: "Let visitors follow you wherever you post.", href: "/dashboard/my-page", action: "Add social links" });
  } else if (visibleSocial > 0 && (!iconsBlock || blockState(iconsBlock, now) !== "live")) {
    out.push({
      id: "icons-off",
      title: "Your social icons are off your page",
      text: "The Social icons block is deleted, hidden or scheduled, so visitors don't see your icons.",
      href: "/dashboard/my-page",
      action: "Show them",
    });
  }

  const expired = input.blocks.filter((block) => blockState(block, now) === "expired").length;
  if (expired > 0) {
    out.push({
      id: "expired",
      title: `Tidy up ${expired === 1 ? "an expired block" : `${expired} expired blocks`}`,
      text: "Their end date has passed, so visitors no longer see them. Delete them or give them a new date.",
      href: "/dashboard/links",
      action: "Review blocks",
    });
  }

  if (input.status === "published" && input.views === 0) {
    out.push({ id: "share", title: "Share your page", text: "No visits in the last 30 days. Add your link to your bios, or share the QR code.", href: "/dashboard/qr", action: "Share" });
  }

  if (input.views >= MEANINGFUL_VIEWS) {
    const linkIndex = new Map(liveLinks.map((block, index) => [block.id, index]));
    const top = input.blockClicks.find((item) => linkIndex.has(item.blockId));
    const topIndex = top ? (linkIndex.get(top.blockId) ?? -1) : -1;
    if (top && top.clicks >= 3 && topIndex >= 3) {
      out.push({
        id: "move-top-link",
        title: `Move "${titleOf(liveLinks[topIndex])}" up`,
        text: "It's your most-clicked link, but it's far down your page. Near the top, more visitors will find it.",
        href: "/dashboard/links",
        action: "Reorder links",
      });
    } else if (input.clicks / input.views < 0.05 && liveLinks.length > 0) {
      out.push({
        id: "low-clicks",
        title: "Help visitors pick a link",
        text: "Fewer than 1 in 20 visitors click anything. Put your most important link first, with a clear, specific title.",
        href: "/dashboard/links",
        action: "Edit links",
      });
    }
  }

  return out.slice(0, limit);
}
