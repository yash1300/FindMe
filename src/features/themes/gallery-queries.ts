import "server-only";

import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type GalleryTheme, type MySharedTheme, parseGalleryTheme } from "./gallery";

/** The most used themes first, then the newest. Signed-in creators only. */
export async function getGalleryThemes(limit = 24): Promise<GalleryTheme[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("gallery_themes")
    .select("id, name, theme, use_count")
    .order("use_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    logger.error("themes.gallery_read_failed", { code: error.code });
    return [];
  }
  return data.flatMap((row) => {
    const theme = parseGalleryTheme(row.theme);
    return theme ? [{ id: row.id, name: row.name, theme, useCount: row.use_count }] : [];
  });
}

/** Themes this person has shared. RLS limits the read to their own. */
export async function getMySharedThemes(): Promise<MySharedTheme[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("shared_themes")
    .select("id, name, status, use_count")
    .order("created_at", { ascending: false });
  if (error) {
    logger.error("themes.mine_read_failed", { code: error.code });
    return [];
  }
  return data.map((row) => ({ id: row.id, name: row.name, status: row.status, useCount: row.use_count }));
}
