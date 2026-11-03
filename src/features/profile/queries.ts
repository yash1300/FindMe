import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { toRenderableBlock, type RenderableBlock } from "@/features/blocks/schema";
import { toRenderableSocialLink } from "@/features/social/platforms";
import { parseTheme } from "@/features/themes/presets";
import { isSupabaseConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createSupabaseAnonClient, createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileViewData } from "./components/profile-view";
import { profileTag, SITEMAP_TAG } from "./tags";

type PublicProfile = ProfileViewData & {
  id: string;
  isIndexable: boolean;
  updatedAt: string;
};

function renderableBlocks(rows: { id: string; type: string; config: unknown }[]): RenderableBlock[] {
  return rows.flatMap((row) => {
    const block = toRenderableBlock(row);
    return block ? [block] : [];
  });
}

function renderableSocial(rows: { id: string; platform: string; url: string }[]) {
  return rows.flatMap((row) => {
    const link = toRenderableSocialLink(row);
    return link ? [link] : [];
  });
}

/**
 * Everything a public page needs, read as an anonymous visitor so it can never include
 * private data. Edits invalidate the tag at once. The short lifetime covers changes no edit
 * triggers, namely a scheduled link starting or ending, which the view works out from the clock.
 */
export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
  "use cache";
  cacheTag(profileTag(username));
  cacheLife({ stale: 30, revalidate: 60, expire: 3600 });

  if (!isSupabaseConfigured()) return null;
  const supabase = createSupabaseAnonClient();

  const { data: profile, error } = await supabase
    .from("public_profiles")
    .select("id, username, display_name, bio, avatar_path, cover_path, theme, is_indexable, updated_at")
    .eq("username", username)
    .maybeSingle<{
      id: string;
      username: string;
      display_name: string;
      bio: string | null;
      avatar_path: string | null;
      cover_path: string | null;
      theme: unknown;
      is_indexable: boolean;
      updated_at: string;
    }>();

  if (error) {
    // Thrown rather than returned as null, so that an outage isn't cached as "page not found".
    logger.error("profile.read_failed", { code: error.code });
    throw new Error("Could not read profile");
  }
  if (!profile) return null;

  const [blocks, social] = await Promise.all([
    supabase
      .from("public_blocks")
      .select("id, type, config")
      .eq("profile_id", profile.id)
      .order("position")
      .limit(200),
    supabase
      .from("public_social_links")
      .select("id, platform, url")
      .eq("profile_id", profile.id)
      .order("position")
      .limit(20),
  ]);
  if (blocks.error || social.error) {
    logger.error("profile.content_read_failed", { blocks: blocks.error?.code, social: social.error?.code });
    throw new Error("Could not read profile content");
  }

  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name,
    bio: profile.bio,
    avatarPath: profile.avatar_path,
    coverPath: profile.cover_path,
    theme: parseTheme(profile.theme),
    isIndexable: profile.is_indexable,
    updatedAt: profile.updated_at,
    blocks: renderableBlocks(blocks.data),
    socialLinks: renderableSocial(social.data),
  };
}

export type SitemapProfile = { username: string; updatedAt: string };

export async function getSitemapProfiles(): Promise<SitemapProfile[]> {
  "use cache";
  cacheTag(SITEMAP_TAG);
  cacheLife("hours");

  if (!isSupabaseConfigured()) return [];
  const { data, error } = await createSupabaseAnonClient()
    .from("public_profiles")
    .select("username, updated_at")
    .eq("is_indexable", true)
    .order("updated_at", { ascending: false })
    .limit(50000);

  if (error) {
    logger.error("sitemap.read_failed", { code: error.code });
    return [];
  }
  return data.map((row) => ({ username: row.username, updatedAt: row.updated_at }));
}

export type OwnerBlock = {
  id: string;
  type: string;
  config: Record<string, unknown>;
  is_visible: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

export type OwnerSocialLink = { id: string; platform: string; url: string; is_visible: boolean };

/** The owner's own content, including hidden and scheduled items. Runs under their session and RLS. */
export async function getOwnerContent(profileId: string) {
  const supabase = await createSupabaseServerClient();
  const [blocks, social] = await Promise.all([
    supabase
      .from("blocks")
      .select("id, type, config, is_visible, starts_at, ends_at")
      .eq("profile_id", profileId)
      .order("position")
      .order("created_at"),
    supabase
      .from("social_links")
      .select("id, platform, url, is_visible")
      .eq("profile_id", profileId)
      .order("position")
      .order("created_at"),
  ]);
  if (blocks.error) throw new Error(`Could not load blocks: ${blocks.error.message}`);
  if (social.error) throw new Error(`Could not load social links: ${social.error.message}`);
  return { blocks: blocks.data as OwnerBlock[], socialLinks: social.data as OwnerSocialLink[] };
}
