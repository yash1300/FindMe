"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { type ActionState, formError, formValues, UNAVAILABLE_MESSAGE } from "@/features/auth/action-state";
import { requireStaff } from "@/features/auth/session";
import { profileTag, SITEMAP_TAG } from "@/features/profile/tags";
import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const reasonSchema = z.string().trim().min(3, "Give a short reason. It's kept in the log.").max(1000, "Use at most 1000 characters.");
const idSchema = z.uuid();

function fail(event: string, error: { code?: string; message: string }): ActionState {
  // These messages come from checks written in our own database functions, and are safe to show staff.
  if (error.code === "P0004" || error.code === "P0005") return formError(error.message);
  logger.error(event, { code: error.code });
  return formError(UNAVAILABLE_MESSAGE);
}

/** Pages show cached copies, so moderation has to clear them or a suspended page stays visible. */
async function clearProfileCache(filter: { id?: string; owner_id?: string }) {
  const query = createSupabaseAdminClient().from("profiles").select("username");
  const { data } = await (filter.id ? query.eq("id", filter.id) : query.eq("owner_id", filter.owner_id as string));
  for (const row of data ?? []) updateTag(profileTag(row.username));
  updateTag(SITEMAP_TAG);
}

export async function setAccountStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireStaff();
  const { target, status, reason } = formValues(formData, ["target", "status", "reason"]);
  const parsedReason = reasonSchema.safeParse(reason ?? "");
  if (!parsedReason.success) return { status: "error", fieldErrors: { reason: parsedReason.error.issues[0].message } };
  if (!idSchema.safeParse(target).success || (status !== "active" && status !== "suspended")) return formError(UNAVAILABLE_MESSAGE);

  const { error } = await createSupabaseAdminClient().rpc("admin_set_account_status", {
    p_actor: user.id, p_target: target, p_status: status, p_reason: parsedReason.data,
  });
  if (error) return fail("admin.account_status_failed", error);

  await clearProfileCache({ owner_id: target });
  revalidatePath("/admin", "layout");
  return { status: "success", message: status === "suspended" ? "Account suspended." : "Account restored." };
}

export async function setProfileSuspendedAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireStaff();
  const { profile, suspended, reason, report } = formValues(formData, ["profile", "suspended", "reason", "report"]);
  const parsedReason = reasonSchema.safeParse(reason ?? "");
  if (!parsedReason.success) return { status: "error", fieldErrors: { reason: parsedReason.error.issues[0].message } };
  if (!idSchema.safeParse(profile).success) return formError(UNAVAILABLE_MESSAGE);

  const { error } = await createSupabaseAdminClient().rpc("admin_set_profile_suspended", {
    p_actor: user.id, p_profile: profile, p_suspended: suspended === "true", p_reason: parsedReason.data,
    p_report: idSchema.safeParse(report).success ? report : null,
  });
  if (error) return fail("admin.profile_status_failed", error);

  await clearProfileCache({ id: profile });
  revalidatePath("/admin", "layout");
  return { status: "success", message: suspended === "true" ? "Page suspended." : "Page restored as unpublished." };
}

export async function hideBlockAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireStaff();
  const { block, profile, reason, report } = formValues(formData, ["block", "profile", "reason", "report"]);
  const parsedReason = reasonSchema.safeParse(reason ?? "");
  if (!parsedReason.success) return { status: "error", fieldErrors: { reason: parsedReason.error.issues[0].message } };
  if (!idSchema.safeParse(block).success) return formError(UNAVAILABLE_MESSAGE);

  const { error } = await createSupabaseAdminClient().rpc("admin_hide_block", {
    p_actor: user.id, p_block: block, p_reason: parsedReason.data, p_report: idSchema.safeParse(report).success ? report : null,
  });
  if (error) return fail("admin.hide_block_failed", error);

  if (idSchema.safeParse(profile).success) await clearProfileCache({ id: profile });
  revalidatePath("/admin", "layout");
  return { status: "success", message: "Link hidden." };
}

export async function closeReportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireStaff();
  const { report, status, reason } = formValues(formData, ["report", "status", "reason"]);
  const parsedReason = reasonSchema.safeParse(reason ?? "");
  if (!parsedReason.success) return { status: "error", fieldErrors: { reason: parsedReason.error.issues[0].message } };
  if (!idSchema.safeParse(report).success) return formError(UNAVAILABLE_MESSAGE);

  const { error } = await createSupabaseAdminClient().rpc("admin_close_report", {
    p_actor: user.id, p_report: report, p_status: status, p_reason: parsedReason.data,
  });
  if (error) return fail("admin.close_report_failed", error);

  revalidatePath("/admin", "layout");
  return { status: "success", message: "Report closed." };
}

export async function removeSharedThemeAsStaffAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireStaff();
  const { theme, reason } = formValues(formData, ["theme", "reason"]);
  const parsedReason = reasonSchema.safeParse(reason ?? "");
  if (!parsedReason.success) return { status: "error", fieldErrors: { reason: parsedReason.error.issues[0].message } };
  if (!idSchema.safeParse(theme).success) return formError(UNAVAILABLE_MESSAGE);

  const { error } = await createSupabaseAdminClient().rpc("admin_remove_shared_theme", {
    p_actor: user.id, p_theme: theme, p_reason: parsedReason.data,
  });
  if (error) return fail("admin.remove_theme_failed", error);

  revalidatePath("/admin", "layout");
  return { status: "success", message: "Theme removed from the gallery." };
}

export async function updateSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireStaff({ adminOnly: true });
  const { maxProfiles, announcement } = formValues(formData, ["maxProfiles", "announcement"]);

  const parsedMax = z.coerce.number().int().min(1).max(50).safeParse(maxProfiles);
  if (!parsedMax.success) return { status: "error", fieldErrors: { maxProfiles: "Use a whole number from 1 to 50." } };
  const text = (announcement ?? "").trim();
  if (text.length > 200) return { status: "error", fieldErrors: { announcement: "Use at most 200 characters." } };

  const admin = createSupabaseAdminClient();
  for (const [key, value] of [["max_profiles_per_account", parsedMax.data], ["announcement", text]] as const) {
    const { error } = await admin.rpc("admin_update_setting", { p_actor: user.id, p_key: key, p_value: value });
    if (error) return fail("admin.settings_failed", error);
  }
  revalidatePath("/admin", "layout");
  revalidatePath("/dashboard", "layout");
  return { status: "success", message: "Settings saved." };
}
