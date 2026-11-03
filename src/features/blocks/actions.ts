"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { fieldErrorsFrom } from "@/features/auth/action-state";
import { requireProfileOwner } from "@/features/auth/session";
import { isMediaPathOwnedBy, mediaPathSchema } from "@/features/media/paths";
import { limitUser } from "@/features/profile/guard";
import type { OwnerBlock } from "@/features/profile/queries";
import { type ActionResult, failure } from "@/features/profile/result";
import { profileTag } from "@/features/profile/tags";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { blockScheduleSchema, isBlockType, parseBlockConfig, type BlockType } from "./schema";

const COLUMNS = "id, type, config, is_visible, starts_at, ends_at";
const idSchema = z.uuid();

const LIMIT_REACHED = "You've reached the maximum of 200 blocks on a page.";

/** Validated config plus schedule, or field errors for the form. */
function validate(type: BlockType, config: unknown, schedule: unknown, userId: string) {
  const parsedConfig = parseBlockConfig(type, config);
  if (!parsedConfig.success) return failure("Please check the highlighted fields.", fieldErrorsFrom(parsedConfig.error));

  const parsedSchedule = blockScheduleSchema.safeParse(schedule);
  if (!parsedSchedule.success) return failure("Please check the highlighted fields.", fieldErrorsFrom(parsedSchedule.error));

  // Images may only come from the creator's own uploads.
  for (const value of Object.values(parsedConfig.data)) {
    if (typeof value === "string" && mediaPathSchema.safeParse(value).success && !isMediaPathOwnedBy(value, userId)) {
      return failure("That image isn't available.");
    }
  }

  return { ok: true as const, config: parsedConfig.data, schedule: parsedSchedule.data };
}

export async function createBlockAction(input: {
  type: string;
  config: unknown;
  schedule?: unknown;
}): Promise<ActionResult<{ block: OwnerBlock }>> {
  const { user, profile } = await requireProfileOwner();
  if (!isBlockType(input.type)) return failure("That block type isn't available.");

  const valid = validate(input.type, input.config, input.schedule ?? {}, user.id);
  if (!valid.ok) return valid;

  const limited = await limitUser(user.id);
  if (limited) return limited;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("blocks")
    .insert({
      profile_id: profile.id,
      type: input.type,
      config: valid.config,
      starts_at: valid.schedule.startsAt ?? null,
      ends_at: valid.schedule.endsAt ?? null,
    })
    .select(COLUMNS)
    .single<OwnerBlock>();

  if (error) {
    if (error.message.includes("block limit")) return failure(LIMIT_REACHED);
    logger.error("blocks.create_failed", { code: error.code });
    return failure();
  }
  updateTag(profileTag(profile.username));
  return { ok: true, block: data };
}

export async function updateBlockAction(input: {
  id: string;
  type: string;
  config: unknown;
  schedule?: unknown;
}): Promise<ActionResult<{ block: OwnerBlock }>> {
  const { user, profile } = await requireProfileOwner();
  if (!idSchema.safeParse(input.id).success || !isBlockType(input.type)) return failure();

  const valid = validate(input.type, input.config, input.schedule ?? {}, user.id);
  if (!valid.ok) return valid;

  const limited = await limitUser(user.id);
  if (limited) return limited;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("blocks")
    .update({
      config: valid.config,
      starts_at: valid.schedule.startsAt ?? null,
      ends_at: valid.schedule.endsAt ?? null,
    })
    .eq("id", input.id)
    .eq("profile_id", profile.id)
    .eq("type", input.type)
    .select(COLUMNS)
    .maybeSingle<OwnerBlock>();

  if (error) {
    logger.error("blocks.update_failed", { code: error.code });
    return failure();
  }
  if (!data) return failure("This block no longer exists. Please reload the page.");
  updateTag(profileTag(profile.username));
  return { ok: true, block: data };
}

export async function setBlockVisibilityAction(id: string, isVisible: boolean): Promise<ActionResult> {
  const { user, profile } = await requireProfileOwner();
  if (!idSchema.safeParse(id).success) return failure();

  const limited = await limitUser(user.id);
  if (limited) return limited;

  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase
    .from("blocks")
    .update({ is_visible: Boolean(isVisible) }, { count: "exact" })
    .eq("id", id)
    .eq("profile_id", profile.id);
  if (error) {
    logger.error("blocks.visibility_failed", { code: error.code });
    return failure();
  }
  if (!count) return failure("This block no longer exists. Please reload the page.");
  updateTag(profileTag(profile.username));
  return { ok: true };
}

export async function deleteBlockAction(id: string): Promise<ActionResult> {
  const { user, profile } = await requireProfileOwner();
  if (!idSchema.safeParse(id).success) return failure();

  const limited = await limitUser(user.id);
  if (limited) return limited;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("blocks").delete().eq("id", id).eq("profile_id", profile.id);
  if (error) {
    logger.error("blocks.delete_failed", { code: error.code });
    return failure();
  }
  updateTag(profileTag(profile.username));
  return { ok: true };
}

/** Copies a block and places it straight after the original. */
export async function duplicateBlockAction(id: string): Promise<ActionResult<{ block: OwnerBlock; order: string[] }>> {
  const { user, profile } = await requireProfileOwner();
  if (!idSchema.safeParse(id).success) return failure();

  const limited = await limitUser(user.id);
  if (limited) return limited;

  const supabase = await createSupabaseServerClient();
  const { data: rows, error: readError } = await supabase
    .from("blocks")
    .select(COLUMNS)
    .eq("profile_id", profile.id)
    .order("position")
    .order("created_at");
  if (readError) {
    logger.error("blocks.duplicate_read_failed", { code: readError.code });
    return failure();
  }

  const original = (rows as OwnerBlock[]).find((row) => row.id === id);
  if (!original) return failure("This block no longer exists. Please reload the page.");

  const { data: copy, error } = await supabase
    .from("blocks")
    .insert({
      profile_id: profile.id,
      type: original.type,
      config: original.config,
      is_visible: original.is_visible,
      starts_at: original.starts_at,
      ends_at: original.ends_at,
    })
    .select(COLUMNS)
    .single<OwnerBlock>();
  if (error) {
    if (error.message.includes("block limit")) return failure(LIMIT_REACHED);
    logger.error("blocks.duplicate_failed", { code: error.code });
    return failure();
  }

  const order = (rows as OwnerBlock[]).flatMap((row) => (row.id === id ? [row.id, copy.id] : [row.id]));
  const { error: reorderError } = await supabase.rpc("reorder_blocks", { p_profile_id: profile.id, p_ids: order });
  if (reorderError) logger.warn("blocks.duplicate_reorder_failed", { code: reorderError.code });

  updateTag(profileTag(profile.username));
  return {
    ok: true,
    block: copy,
    // If placing it failed, the copy is simply at the end. Report where it really is.
    order: reorderError ? [...(rows as OwnerBlock[]).map((row) => row.id), copy.id] : order,
  };
}

/** The database rejects a list that doesn't match exactly, so a stale tab can't scramble the page. */
export async function reorderBlocksAction(ids: string[]): Promise<ActionResult> {
  const { user, profile } = await requireProfileOwner();
  const parsed = z.array(z.uuid()).max(200).safeParse(ids);
  if (!parsed.success) return failure();

  const limited = await limitUser(user.id);
  if (limited) return limited;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("reorder_blocks", { p_profile_id: profile.id, p_ids: parsed.data });
  if (error) {
    if (error.code === "P0003") {
      return { ok: false, code: "conflict", message: "Your blocks changed somewhere else. Please reload the page." };
    }
    logger.error("blocks.reorder_failed", { code: error.code });
    return failure("We couldn't save the new order.");
  }
  updateTag(profileTag(profile.username));
  return { ok: true };
}
