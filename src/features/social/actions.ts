"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { requireProfileOwner } from "@/features/auth/session";
import { limitUser } from "@/features/profile/guard";
import type { OwnerSocialLink } from "@/features/profile/queries";
import { type ActionResult, failure } from "@/features/profile/result";
import { profileTag } from "@/features/profile/tags";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSocialPlatform, normalizeSocialUrl, platformLabel } from "./platforms";

const COLUMNS = "id, platform, url, is_visible";
const idSchema = z.uuid();

/** Adds a platform, or updates its link if it's already there. */
export async function saveSocialLinkAction(input: {
  platform: string;
  url: string;
}): Promise<ActionResult<{ link: OwnerSocialLink }>> {
  const { user, profile } = await requireProfileOwner();
  if (!isSocialPlatform(input.platform)) return failure("That platform isn't available.");

  const url = normalizeSocialUrl(input.platform, String(input.url ?? ""));
  if (!url) {
    const label = platformLabel(input.platform);
    const message = input.platform === "email" ? "Enter a valid email address." : `Enter a valid ${label} link.`;
    return failure(message, { url: message });
  }

  const limited = await limitUser(user.id);
  if (limited) return limited;

  const supabase = await createSupabaseServerClient();
  const { data: updated, error: updateError } = await supabase
    .from("social_links")
    .update({ url })
    .eq("profile_id", profile.id)
    .eq("platform", input.platform)
    .select(COLUMNS)
    .maybeSingle<OwnerSocialLink>();
  if (updateError) {
    logger.error("social.update_failed", { code: updateError.code });
    return failure();
  }

  let link = updated;
  if (!link) {
    const { data, error } = await supabase
      .from("social_links")
      .insert({ profile_id: profile.id, platform: input.platform, url })
      .select(COLUMNS)
      .single<OwnerSocialLink>();
    if (error) {
      logger.error("social.insert_failed", { code: error.code });
      return failure();
    }
    link = data;
  }

  updateTag(profileTag(profile.username));
  return { ok: true, link };
}

export async function setSocialVisibilityAction(id: string, isVisible: boolean): Promise<ActionResult> {
  const { user, profile } = await requireProfileOwner();
  if (!idSchema.safeParse(id).success) return failure();

  const limited = await limitUser(user.id);
  if (limited) return limited;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("social_links")
    .update({ is_visible: Boolean(isVisible) })
    .eq("id", id)
    .eq("profile_id", profile.id);
  if (error) {
    logger.error("social.visibility_failed", { code: error.code });
    return failure();
  }
  updateTag(profileTag(profile.username));
  return { ok: true };
}

export async function deleteSocialLinkAction(id: string): Promise<ActionResult> {
  const { user, profile } = await requireProfileOwner();
  if (!idSchema.safeParse(id).success) return failure();

  const limited = await limitUser(user.id);
  if (limited) return limited;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("social_links").delete().eq("id", id).eq("profile_id", profile.id);
  if (error) {
    logger.error("social.delete_failed", { code: error.code });
    return failure();
  }
  updateTag(profileTag(profile.username));
  return { ok: true };
}

export async function reorderSocialLinksAction(ids: string[]): Promise<ActionResult> {
  const { user, profile } = await requireProfileOwner();
  const parsed = z.array(z.uuid()).max(20).safeParse(ids);
  if (!parsed.success) return failure();

  const limited = await limitUser(user.id);
  if (limited) return limited;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("reorder_social_links", { p_profile_id: profile.id, p_ids: parsed.data });
  if (error) {
    if (error.code === "P0003") {
      return { ok: false, code: "conflict", message: "Your links changed somewhere else. Please reload the page." };
    }
    logger.error("social.reorder_failed", { code: error.code });
    return failure("We couldn't save the new order.");
  }
  updateTag(profileTag(profile.username));
  return { ok: true };
}
