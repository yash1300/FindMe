import type { RenderableBlock } from "./schema";

/** Where a block links to, read from its validated config, or null if it doesn't link anywhere. */
export function blockDestination(block: RenderableBlock): string | null {
  switch (block.type) {
    case "link":
    case "featured_link":
    case "product_card":
      return block.config.url;
    case "announcement":
      return block.config.url ?? null;
    case "image":
      return block.config.linkUrl ?? null;
    default:
      return null;
  }
}
