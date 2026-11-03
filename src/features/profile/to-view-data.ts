import { toRenderableBlock } from "@/features/blocks/schema";
import { toRenderableSocialLink } from "@/features/social/platforms";
import { parseTheme } from "@/features/themes/presets";
import type { Theme } from "@/features/themes/schema";
import type { ProfileViewData } from "./components/profile-view";

type OwnerProfile = {
  username: string;
  display_name: string;
  bio?: string | null;
  avatar_path?: string | null;
  cover_path?: string | null;
  theme?: unknown;
};

type BlockRow = {
  id: string;
  type: string;
  config: unknown;
  is_visible?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
};

/** Mirrors the public_blocks view, so the preview matches what visitors would see right now. */
function isLiveNow(row: BlockRow, now: number): boolean {
  if (row.is_visible === false) return false;
  if (row.starts_at && new Date(row.starts_at).getTime() > now) return false;
  if (row.ends_at && new Date(row.ends_at).getTime() <= now) return false;
  return true;
}
type SocialRow = { id: string; platform: string; url: string; is_visible?: boolean };

/** Builds the preview from the owner's rows, showing only what would be visible to the public. */
export function toViewData(
  profile: OwnerProfile,
  blocks: BlockRow[],
  socialLinks: SocialRow[],
  themeOverride?: Theme,
): ProfileViewData {
  const now = Date.now();
  return {
    username: profile.username,
    displayName: profile.display_name,
    bio: profile.bio ?? null,
    avatarPath: profile.avatar_path ?? null,
    coverPath: profile.cover_path ?? null,
    theme: themeOverride ?? parseTheme(profile.theme),
    blocks: blocks.flatMap((row) => {
      if (!isLiveNow(row, now)) return [];
      const block = toRenderableBlock(row);
      return block ? [block] : [];
    }),
    socialLinks: socialLinks.flatMap((row) => {
      if (row.is_visible === false) return [];
      const link = toRenderableSocialLink(row);
      return link ? [link] : [];
    }),
  };
}
