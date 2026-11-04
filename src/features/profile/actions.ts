"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { fieldErrorsFrom } from "@/features/auth/action-state";
import { displayNameSchema } from "@/features/auth/schema";
import { requireProfileOwner } from "@/features/auth/session";
import { isMediaPathOwnedBy, mediaPathSchema } from "@/features/media/paths";
import { themeSchema } from "@/features/themes/schema";
import { usernameSchema } from "@/features/usernames/schema";
import { logger } from "@/lib/logger";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { limitUser } from "./guard";
import { type ActionResult, failure } from "./result";
import { profileTag, SITEMAP_TAG } from "./tags";

const CONFLICT = {
  ok: false as const,
  code: "conflict" as const,
  message: "This page was changed somewhere else, such as in another tab. Reload to get the latest version.",
};

const detailsSchema = z.object({
  displayName: displayNameSchema,
  bio: z.string().trim().max(300, "Use at most 300 characters."),
  category: z.string().trim().max(64, "Use at most 64 characters."),
  avatarPath: mediaPathSchema.nullable(),
  coverPath: mediaPathSchema.nullable(),
  isIndexable: z.boolean(),
  // The onboarding wizard doesn't ask about this, so it leaves the setting as it is.
  analyticsEnabled: z.boolean().optional(),
  expectedVersion: z.number().int().positive(),
});

export async function updateProfileDetailsAction(input: unknown): Promise<ActionResult<{ version: number }>> {
  const { user, profile } = await requireProfileOwner();

  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) return failure("Please check the highlighted fields.", fieldErrorsFrom(parsed.error));

  const { displayName, bio, category, avatarPath, coverPath, isIndexable, analyticsEnabled, expectedVersion } = parsed.data;
  for (const path of [avatarPath, coverPath]) {
    if (path && !isMediaPathOwnedBy(path, user.id)) return failure("That image isn't available.");
  }

  const limited = await limitUser(user.id);
  if (limited) return limited;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      bio: bio || null,
      category: category || null,
      avatar_path: avatarPath,
      cover_path: coverPath,
      is_indexable: isIndexable,
      ...(analyticsEnabled === undefined ? {} : { analytics_enabled: analyticsEnabled }),
    })
    .eq("id", profile.id)
    .eq("version", expectedVersion)
    .select("version")
    .maybeSingle<{ version: number }>();

  if (error) {
    logger.error("profile.update_failed", { code: error.code });
    return failure();
  }
  if (!data) return CONFLICT;

  updateTag(profileTag(profile.username));
  updateTag(SITEMAP_TAG);
  return { ok: true, version: Number(data.version) };
}

/** Saves a theme only if nothing else changed the page since this editor loaded it. */
export async function saveThemeAction(input: {
  theme: unknown;
  expectedVersion: number;
}): Promise<ActionResult<{ version: number }>> {
  const { user, profile } = await requireProfileOwner();

  const parsed = themeSchema.safeParse(input.theme);
  if (!parsed.success || !Number.isInteger(input.expectedVersion)) return failure("That theme isn't valid.");

  const imagePath = parsed.data.background.imagePath;
  if (imagePath && !isMediaPathOwnedBy(imagePath, user.id)) return failure("That image isn't available.");

  const limited = await limitUser(user.id);
  if (limited) return limited;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ theme: parsed.data })
    .eq("id", profile.id)
    .eq("version", input.expectedVersion)
    .select("version")
    .maybeSingle<{ version: number }>();

  if (error) {
    logger.error("profile.theme_save_failed", { code: error.code });
    return failure();
  }
  if (!data) return CONFLICT;

  updateTag(profileTag(profile.username));
  return { ok: true, version: Number(data.version) };
}

export async function changeUsernameAction(input: { username: string }): Promise<ActionResult<{ username: string; version: number }>> {
  const { user, profile } = await requireProfileOwner();

  const parsed = usernameSchema.safeParse(input.username);
  if (!parsed.success) {
    const message = parsed.error.issues[0].message;
    return failure(message, { username: message });
  }
  if (parsed.data === profile.username) return { ok: true, username: profile.username, version: Number(profile.version) };

  const limited = await limitUser(user.id, "username", RATE_LIMITS.claimByUser);
  if (limited) return limited;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ username: parsed.data })
    .eq("id", profile.id)
    .select("version")
    .single<{ version: number }>();

  if (error) {
    if (error.code === "23505" || error.code === "23514") {
      const message = "This username isn't available.";
      return failure(message, { username: message });
    }
    if (error.code === "P0002") {
      const message = "You changed your username recently. You can change it again after 24 hours.";
      return failure(message, { username: message });
    }
    logger.error("profile.rename_failed", { code: error.code });
    return failure();
  }

  updateTag(profileTag(profile.username));
  updateTag(profileTag(parsed.data));
  updateTag(SITEMAP_TAG);
  return { ok: true, username: parsed.data, version: Number(data.version) };
}

const statusSchema = z.enum(["published", "unpublished"]);

export async function setPublishStatusAction(status: string): Promise<ActionResult<{ status: string; version: number }>> {
  const { user, profile } = await requireProfileOwner();

  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) return failure();

  const limited = await limitUser(user.id);
  if (limited) return limited;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ status: parsed.data })
    .eq("id", profile.id)
    .select("status, version")
    .single<{ status: string; version: number }>();

  if (error) {
    if (error.code === "42501") return failure("This page has been suspended and can't be changed.");
    logger.error("profile.publish_failed", { code: error.code });
    return failure();
  }

  updateTag(profileTag(profile.username));
  updateTag(SITEMAP_TAG);
  return { ok: true, status: data.status, version: Number(data.version) };
}

export async function completeWizardAction(input: { publish: boolean }): Promise<ActionResult> {
  const { profile } = await requireProfileOwner();

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      onboarding_completed_at: new Date().toISOString(),
      ...(input.publish ? { status: "published" } : {}),
    })
    .eq("id", profile.id);

  if (error) {
    logger.error("profile.wizard_complete_failed", { code: error.code });
    return failure();
  }

  updateTag(profileTag(profile.username));
  updateTag(SITEMAP_TAG);
  return { ok: true };
}
