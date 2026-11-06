import { BLOCK_DEFINITIONS } from "@/features/blocks/definitions";
import { isBlockType } from "@/features/blocks/schema";

type NamedBlock = { id: string; type: string; config: Record<string, unknown> };

/** What a creator would call a block in a report: its title, or failing that its kind. */
export function blockNamer(blocks: NamedBlock[]) {
  return (id: string): string => {
    const block = blocks.find((item) => item.id === id);
    if (!block) return "Deleted link";
    const title = block.config.title ?? block.config.text ?? block.config.label;
    if (typeof title === "string" && title) return title;
    return isBlockType(block.type) ? BLOCK_DEFINITIONS[block.type].label : "Link";
  };
}
