"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import {
  type ActionState,
  formError,
  formValues,
  tooManyAttempts,
  UNAVAILABLE_MESSAGE,
  validationError,
} from "@/features/auth/action-state";
import { changePasswordSchema, displayNameSchema, emailOnlySchema, updateNameSchema } from "@/features/auth/schema";
import { getAccountContext, requireUser } from "@/features/auth/session";
import { hasCurrentConsent, PRIVACY_VERSION, TERMS_VERSION } from "@/features/legal/versions";
import { usernameSchema } from "@/features/usernames/schema";
import { getAppUrl } from "@/lib/env";
import { logger } from "@/lib/logger";
import { checkRateLimits, RATE_LIMITS, rateLimitKey, type RateLimitRule } from "@/lib/security/rate-limit";
import { MEDIA_BUCKET } from "@/features/media/paths";
import { profileTag, SITEMAP_TAG } from "@/features/profile/tags";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function enforceUserLimit(scope: string, userId: string, rule: RateLimitRule): Promise<ActionState | null> {
  const result = await checkRateLimits([[rateLimitKey(scope, userId), rule]]);
  if (result.status === "allowed") return null;
  return result.status === "limited" ? tooManyAttempts(result.retryAfterSeconds) : formError(UNAVAILABLE_MESSAGE);
}

/** Finishes setup for anyone missing a profile or current consent, such as new Google users. */
export async function completeOnboardingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/onboarding");
  const { account, profile } = await getAccountContext(user.id);
  if (account.status === "suspended") redirect("/suspended");

  const raw = formValues(formData, ["username", "name", "consent"]);
  const values = { username: raw.username ?? "", name: raw.name ?? "" };
  const fieldErrors: Record<string, string> = {};

  // What's required comes from the account's state on the server, not from what the form sent.
  const needsConsent = !hasCurrentConsent(account);
  if (needsConsent && raw.consent !== "on") {
    fieldErrors.consent = "Please accept the Terms and Privacy Policy to continue.";
  }

  let username = "";
  let displayName = "";
  if (!profile) {
    const parsedUsername = usernameSchema.safeParse(raw.username ?? "");
    if (parsedUsername.success) username = parsedUsername.data;
    else fieldErrors.username = parsedUsername.error.issues[0].message;

    const parsedName = displayNameSchema.safeParse(raw.name ?? "");
    if (parsedName.success) displayName = parsedName.data;
    else fieldErrors.name = parsedName.error.issues[0].message;
  }
  if (Object.keys(fieldErrors).length > 0) return { status: "error", fieldErrors, values };

  const blocked = await enforceUserLimit("onboarding:user", user.id, RATE_LIMITS.claimByUser);
  if (blocked) return { ...blocked, values };

  const supabase = await createSupabaseServerClient();

  if (needsConsent) {
    const { error } = await supabase.rpc("record_consent", {
      p_terms_version: TERMS_VERSION,
      p_privacy_version: PRIVACY_VERSION,
    });
    if (error) {
      logger.error("onboarding.consent_failed", { code: error.code });
      return formError(UNAVAILABLE_MESSAGE, values);
    }
  }

  if (!profile) {
    const { error } = await supabase
      .from("profiles")
      .insert({ owner_id: user.id, username, display_name: displayName });

    if (error) {
      // Unique violation (lost a race) or check violation (blocked by the database's own list).
      if (error.code === "23505" || error.code === "23514") {
        return { status: "error", fieldErrors: { username: "This username isn't available." }, values };
      }
      logger.error("onboarding.profile_failed", { code: error.code });
      return formError(UNAVAILABLE_MESSAGE, values);
    }

    const { error: nameError } = await supabase
      .from("accounts")
      .update({ display_name: displayName })
      .eq("id", user.id);
    if (nameError) logger.warn("onboarding.account_name_failed", { code: nameError.code });
  }

  redirect(profile?.onboarding_completed_at ? "/dashboard" : "/onboarding");
}

export async function updateAccountNameAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/dashboard/settings");
  const parsed = updateNameSchema.safeParse(formValues(formData, ["name"]));
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("accounts").update({ display_name: parsed.data.name }).eq("id", user.id);
  if (error) {
    logger.error("account.update_name_failed", { code: error.code });
    return formError(UNAVAILABLE_MESSAGE);
  }

  revalidatePath("/dashboard", "layout");
  return { status: "success", message: "Name updated.", values: { name: parsed.data.name } };
}

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/dashboard/settings");
  const parsed = changePasswordSchema.safeParse(formValues(formData, ["currentPassword", "password", "confirmPassword"]));
  if (!parsed.success) return validationError(parsed.error);
  if (!user.email) return formError(UNAVAILABLE_MESSAGE);

  const blocked = await enforceUserLimit("password_change:user", user.id, RATE_LIMITS.credentialChangeByUser);
  if (blocked) return blocked;

  const supabase = await createSupabaseServerClient();

  // Re-checks the current password. This also refreshes the sign-in, which Supabase's
  // "secure password change" setting requires for sessions more than a day old.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (verifyError) {
    if (verifyError.code === "invalid_credentials") {
      return { status: "error", fieldErrors: { currentPassword: "That password isn't correct." } };
    }
    logger.error("account.password_verify_failed", { code: verifyError.code, status: verifyError.status });
    return formError(UNAVAILABLE_MESSAGE);
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") {
      return { status: "error", fieldErrors: { password: "That's your current password. Choose a new one." } };
    }
    if (error.code === "weak_password") {
      return { status: "error", fieldErrors: { password: "That password is too easy to guess. Please choose another." } };
    }
    logger.error("account.password_change_failed", { code: error.code, status: error.status });
    return formError(UNAVAILABLE_MESSAGE);
  }

  const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });
  if (signOutError) logger.warn("account.signout_others_failed", { code: signOutError.code });

  return { status: "success", message: "Password changed. Other devices have been signed out." };
}

export async function changeEmailAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/dashboard/settings");
  const parsed = emailOnlySchema.safeParse(formValues(formData, ["email"]));
  if (!parsed.success) return validationError(parsed.error);

  const blocked = await enforceUserLimit("email_change:user", user.id, RATE_LIMITS.credentialChangeByUser);
  if (blocked) return blocked;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: new URL("/auth/callback?next=/dashboard/settings", getAppUrl()).toString() },
  );

  // An address already in use gets the same reply, so this can't be used to discover accounts.
  if (error && error.code !== "email_exists") {
    logger.error("account.email_change_failed", { code: error.code, status: error.status });
    return formError(UNAVAILABLE_MESSAGE);
  }

  return {
    status: "success",
    message: "Check your inbox. The change finishes once you confirm from both your current and new addresses.",
  };
}

const DELETE_WORD = "DELETE";

/**
 * Permanently deletes the account. A password is required too, where there is one, so an unattended
 * signed-in browser isn't enough. Removal of everything else cascades from the login.
 */
export async function deleteAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser("/dashboard/settings");
  const { confirm, password } = formValues(formData, ["confirm", "password"]);
  if (confirm !== DELETE_WORD) return { status: "error", fieldErrors: { confirm: `Type ${DELETE_WORD} to confirm.` } };

  const limited = await enforceUserLimit("account_delete:user", user.id, RATE_LIMITS.credentialChangeByUser);
  if (limited) return limited;

  const supabase = await createSupabaseServerClient();
  const hasPassword = user.identities?.some((identity) => identity.provider === "email") ?? false;
  if (hasPassword) {
    const { error } = user.email && password ? await supabase.auth.signInWithPassword({ email: user.email, password }) : { error: { code: "invalid_credentials" } };
    if (error) return { status: "error", fieldErrors: { password: "That password isn't correct." } };
  }

  const { profiles } = await getAccountContext(user.id);
  const admin = createSupabaseAdminClient();

  // Staff roles guard moderation, so losing one should be deliberate.
  const { data: role } = await admin.from("admin_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (role) return formError("Staff accounts can't be deleted until their role is removed.");

  // Files don't cascade with the database. Failing here leaves the account for the user to retry.
  const files: string[] = [];
  for (let page = 0; ; page += 1) {
    const { data, error } = await admin.storage.from(MEDIA_BUCKET).list(user.id, { limit: 1000, offset: page * 1000 });
    if (error) {
      logger.error("account.delete_list_failed", { message: error.message });
      return formError(UNAVAILABLE_MESSAGE);
    }
    files.push(...data.map((file) => `${user.id}/${file.name}`));
    if (data.length < 1000) break;
  }
  if (files.length > 0) {
    const { error } = await admin.storage.from(MEDIA_BUCKET).remove(files);
    if (error) {
      logger.error("account.delete_files_failed", { message: error.message });
      return formError(UNAVAILABLE_MESSAGE);
    }
  }

  const { error: auditError } = await admin.from("audit_logs").insert({ actor_id: user.id, action: "account.deleted", target_type: "account", target_id: user.id });
  if (auditError) logger.error("account.delete_audit_failed", { code: auditError.code });

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    logger.error("account.delete_failed", { message: error.message });
    return formError(UNAVAILABLE_MESSAGE);
  }

  for (const item of profiles) updateTag(profileTag(item.username));
  updateTag(SITEMAP_TAG);
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  redirect("/");
}
