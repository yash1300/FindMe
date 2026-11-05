"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { requireProfileOwner } from "@/features/auth/session";
import { limitUser } from "@/features/profile/guard";
import { getOwnerContent, type OwnerBlock, type OwnerSocialLink } from "@/features/profile/queries";
import { type ActionResult, failure } from "@/features/profile/result";
import { profileTag } from "@/features/profile/tags";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isButtonForSocialLink, pointsAtSocialLink, socialButtonFor } from "./buttons";
import { isSocialPlatform, normalizeSocialUrl, platformLabel, type SocialPlatformId } from "./platforms";

const COLUMNS = "id, platform, url, is_visible";
const idSchema = z.uuid();

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type ButtonOutcome = "added" | "exists" | "full" | "failed";

async function loadButtons(supabase: Supabase, profileId: string) {
  const { data, error } = await supabase
    .from("blocks")
    .select("id, type, config")
    .eq("profile_id", profileId)
    .in("type", ["link", "featured_link", "email_button"]);
  if (error) {
    logger.error("social.buttons_load_failed", { code: error.code });
    return null;
  }
  return data;
}

/** Adds the button for a social link, unless the page already sends people to that address. */
async function addButton(
  supabase: Supabase,
  profileId: string,
  platform: SocialPlatformId,
  url: string,
  isVisible: boolean,
  existing: Awaited<ReturnType<typeof loadButtons>>,
): Promise<ButtonOutcome> {
  if (!existing) return "failed";
  if (existing.some((block) => pointsAtSocialLink(block, url))) return "exists";

  const button = socialButtonFor(platform, url);
  if (!button) return "failed";
  const { error } = await supabase.from("blocks").insert({ profile_id: profileId, ...button, is_visible: isVisible });
  if (!error) return "added";
  if (error.message.includes("block limit")) return "full";
  logger.error("social.button_create_failed", { code: error.code });
  return "failed";
}

function buttonNotice(outcome: ButtonOutcome, label: string): string | undefined {
  if (outcome === "added") return `${label} now has its own button on your page too. You can edit or remove it under Links.`;
  if (outcome === "full") return `${label} was added as an icon, but your page has too many blocks for another button.`;
  if (outcome === "failed") return `${label} was added as an icon, but we couldn't add its button. Use "Add buttons for my links" to try again.`;
  return undefined;
}

/** Every block on the page, so that a live preview can show what changed. */
async function currentBlocks(profileId: string): Promise<OwnerBlock[] | undefined> {
  try {
    return (await getOwnerContent(profileId)).blocks;
  } catch {
    return undefined;
  }
}

/** Adds a platform and its button, or updates the link if it's already there. */
export async function saveSocialLinkAction(input: {
  platform: string;
  url: string;
}): Promise<ActionResult<{ link: OwnerSocialLink; blocks?: OwnerBlock[]; notice?: string }>> {
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
  const { data: previous } = await supabase
    .from("social_links")
    .select("url")
    .eq("profile_id", profile.id)
    .eq("platform", input.platform)
    .maybeSingle<{ url: string }>();

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

  let notice: string | undefined;
  const buttons = await loadButtons(supabase, profile.id);
  if (!previous) {
    const outcome = await addButton(supabase, profile.id, input.platform, url, link.is_visible, buttons);
    notice = buttonNotice(outcome, platformLabel(input.platform));
  } else if (previous.url !== url) {
    // The button follows the link it was made for.
    const platform = input.platform;
    const next = socialButtonFor(platform, url);
    for (const block of buttons ?? []) {
      if (!next || !isButtonForSocialLink(block, platform, previous.url)) continue;
      const change = platform === "email" ? { email: url.replace(/^mailto:/i, "") } : { url };
      const { error } = await supabase
        .from("blocks")
        .update({ config: { ...(block.config as object), ...change } })
        .eq("id", block.id)
        .eq("profile_id", profile.id);
      if (error) logger.error("social.button_update_failed", { code: error.code });
    }
  }

  updateTag(profileTag(profile.username));
  return { ok: true, link, notice, blocks: await currentBlocks(profile.id) };
}

/** Gives every social link a button, for pages made before buttons were added automatically. */
export async function addSocialButtonsAction(): Promise<ActionResult<{ added: number; blocks?: OwnerBlock[]; message: string }>> {
  const { user, profile } = await requireProfileOwner();
  const limited = await limitUser(user.id);
  if (limited) return limited;

  const supabase = await createSupabaseServerClient();
  const { data: links, error } = await supabase
    .from("social_links")
    .select("platform, url, is_visible")
    .eq("profile_id", profile.id)
    .order("position");
  if (error) {
    logger.error("social.buttons_links_failed", { code: error.code });
    return failure();
  }

  const buttons = await loadButtons(supabase, profile.id);
  if (!buttons) return failure();

  let added = 0;
  let failed = 0;
  for (const link of links) {
    if (!isSocialPlatform(link.platform)) continue;
    const outcome = await addButton(supabase, profile.id, link.platform, link.url, link.is_visible, buttons);
    if (outcome === "added") added += 1;
    if (outcome === "failed" || outcome === "full") failed += 1;
  }

  if (added > 0) updateTag(profileTag(profile.username));
  const message =
    failed > 0
      ? `We added ${added}, but couldn't add ${failed}. Your page may have too many blocks.`
      : added > 0
        ? `Added ${added} ${added === 1 ? "button" : "buttons"} to your page. You can edit them under Links.`
        : "All your links already have buttons.";
  return { ok: true, added, message, blocks: await currentBlocks(profile.id) };
}

/** The button made for a stored social link, if the link and its button still exist. */
async function matchingButtons(supabase: Supabase, profileId: string, id: string) {
  const { data: link } = await supabase
    .from("social_links")
    .select("platform, url")
    .eq("id", id)
    .eq("profile_id", profileId)
    .maybeSingle<{ platform: string; url: string }>();
  if (!link || !isSocialPlatform(link.platform)) return [];
  const platform = link.platform;
  return ((await loadButtons(supabase, profileId)) ?? []).filter((block) => isButtonForSocialLink(block, platform, link.url));
}

export async function setSocialVisibilityAction(id: string, isVisible: boolean): Promise<ActionResult<{ blocks?: OwnerBlock[] }>> {
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
  // Hiding a link hides its button too, so it doesn't stay public by surprise.
  const ids = (await matchingButtons(supabase, profile.id, id)).map((block) => block.id);
  if (ids.length > 0) {
    const { error: buttonError } = await supabase.from("blocks").update({ is_visible: Boolean(isVisible) }).in("id", ids).eq("profile_id", profile.id);
    if (buttonError) logger.error("social.button_visibility_failed", { code: buttonError.code });
  }
  updateTag(profileTag(profile.username));
  return { ok: true, blocks: await currentBlocks(profile.id) };
}

export async function deleteSocialLinkAction(id: string): Promise<ActionResult<{ blocks?: OwnerBlock[] }>> {
  const { user, profile } = await requireProfileOwner();
  if (!idSchema.safeParse(id).success) return failure();

  const limited = await limitUser(user.id);
  if (limited) return limited;

  const supabase = await createSupabaseServerClient();
  // Found first, because the match relies on the link's address. Removing a link removes its
  // button, so that something the creator took down doesn't stay on their page.
  const ids = (await matchingButtons(supabase, profile.id, id)).map((block) => block.id);
  const { error } = await supabase.from("social_links").delete().eq("id", id).eq("profile_id", profile.id);
  if (error) {
    logger.error("social.delete_failed", { code: error.code });
    return failure();
  }
  if (ids.length > 0) {
    const { error: buttonError } = await supabase.from("blocks").delete().in("id", ids).eq("profile_id", profile.id);
    if (buttonError) logger.error("social.button_delete_failed", { code: buttonError.code });
  }
  updateTag(profileTag(profile.username));
  return { ok: true, blocks: await currentBlocks(profile.id) };
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
