"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { requireProfileOwner } from "@/features/auth/session";
import { limitUser } from "@/features/profile/guard";
import { type ActionResult, failure } from "@/features/profile/result";
import { profileTag } from "@/features/profile/tags";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseGalleryTheme, shareableTheme, themeNameSchema } from "./gallery";
import { parseTheme } from "./presets";

const idSchema = z.uuid();

/** Shares the page's saved theme. Unsaved edits aren't included, so what's shared is what visitors see. */
export async function shareThemeAction(input: { name: string }): Promise<ActionResult> {
  const { user, profile } = await requireProfileOwner();
  const name = themeNameSchema.safeParse(input.name ?? "");
  if (!name.success) return failure(name.error.issues[0].message, { name: name.error.issues[0].message });

  const limited = await limitUser(user.id);
  if (limited) return limited;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("shared_themes")
    .insert({ owner_id: user.id, name: name.data, theme: shareableTheme(parseTheme(profile.theme)) });
  if (error) {
    if (error.message.includes("shared theme limit")) return failure("You can share up to 10 themes. Remove one to share another.");
    logger.error("themes.share_failed", { code: error.code });
    return failure();
  }
  return { ok: true };
}

export async function removeSharedThemeAction(id: string): Promise<ActionResult> {
  const { user } = await requireProfileOwner();
  if (!idSchema.safeParse(id).success) return failure();

  const limited = await limitUser(user.id);
  if (limited) return limited;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("shared_themes").delete().eq("id", id).eq("owner_id", user.id);
  if (error) {
    logger.error("themes.unshare_failed", { code: error.code });
    return failure();
  }
  return { ok: true };
}

/** Replaces the selected page's theme with one from the gallery. */
export async function applyGalleryThemeAction(id: string): Promise<ActionResult> {
  const { user, profile } = await requireProfileOwner();
  if (!idSchema.safeParse(id).success) return failure();

  const limited = await limitUser(user.id);
  if (limited) return limited;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("use_gallery_theme", { p_id: id });
  if (error) {
    if (error.code === "P0002") return failure("That theme is no longer in the gallery.");
    logger.error("themes.gallery_use_failed", { code: error.code });
    return failure();
  }
  const theme = parseGalleryTheme(data);
  if (!theme) return failure("That theme can't be used.");

  const { error: saveError } = await supabase.from("profiles").update({ theme }).eq("id", profile.id);
  if (saveError) {
    logger.error("themes.gallery_apply_failed", { code: saveError.code });
    return failure();
  }
  updateTag(profileTag(profile.username));
  return { ok: true };
}
