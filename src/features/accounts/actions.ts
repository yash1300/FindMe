"use server";

import { revalidatePath } from "next/cache";
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
