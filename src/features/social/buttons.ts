import { parseBlockConfig } from "@/features/blocks/schema";
import { platformLabel, type SocialPlatformId } from "./platforms";

type BlockLike = { type: string; config: unknown };

const emailOf = (url: string) => url.replace(/^mailto:/i, "").toLowerCase();

function configOf(block: BlockLike): Record<string, unknown> {
  return block.config && typeof block.config === "object" ? (block.config as Record<string, unknown>) : {};
}

/** The button a social link adds to the page, which the creator can then edit like any other block. */
export function socialButtonFor(platform: SocialPlatformId, url: string) {
  if (platform === "email") {
    const parsed = parseBlockConfig("email_button", { label: "Email me", email: url.replace(/^mailto:/i, "") });
    return parsed.success ? { type: "email_button" as const, config: parsed.data } : null;
  }
  const parsed = parseBlockConfig("link", { title: platformLabel(platform), url, platform });
  return parsed.success ? { type: "link" as const, config: parsed.data } : null;
}

/** Whether a block already sends people to this address, so a second button isn't added. */
export function pointsAtSocialLink(block: BlockLike, url: string): boolean {
  const config = configOf(block);
  if (block.type === "email_button") return url.toLowerCase().startsWith("mailto:") && String(config.email ?? "").toLowerCase() === emailOf(url);
  return (block.type === "link" || block.type === "featured_link") && config.url === url;
}

/**
 * Whether a block is the button made for this social link. A button the creator has pointed
 * somewhere else is theirs now, so changes to the social link leave it alone.
 */
export function isButtonForSocialLink(block: BlockLike, platform: SocialPlatformId, url: string): boolean {
  if (platform === "email") return block.type === "email_button" && pointsAtSocialLink(block, url);
  return block.type === "link" && configOf(block).platform === platform && configOf(block).url === url;
}
