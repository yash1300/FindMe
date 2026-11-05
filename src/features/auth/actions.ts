"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/features/legal/versions";
import { getAppUrl, isGoogleAuthEnabled, isSupabaseConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getClientIp } from "@/lib/security/client-ip";
import { checkRateLimits, RATE_LIMITS, rateLimitKey, type RateLimitRule } from "@/lib/security/rate-limit";
import { safeRedirectPath } from "@/lib/security/safe-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  type ActionState,
  formError,
  formValues,
  tooManyAttempts,
  UNAVAILABLE_MESSAGE,
  validationError,
} from "./action-state";
import { ACTIVE_PROFILE_COOKIE, RECOVERY_COOKIE } from "./constants";
import { emailOnlySchema, loginSchema, registerSchema, resetPasswordSchema } from "./schema";

async function clientIp(): Promise<string> {
  return getClientIp(await headers());
}

/** Returns a failure state when the request may not proceed, or null when it may. */
async function enforceLimits(
  checks: ReadonlyArray<readonly [key: string, rule: RateLimitRule]>,
  values?: Record<string, string>,
): Promise<ActionState | null> {
  const result = await checkRateLimits(checks);
  if (result.status === "allowed") return null;
  if (result.status === "limited") return tooManyAttempts(result.retryAfterSeconds, values);
  return formError(UNAVAILABLE_MESSAGE, values);
}

function callbackUrl(next?: string): string {
  const url = new URL("/auth/callback", getAppUrl());
  if (next) url.searchParams.set("next", next);
  return url.toString();
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formValues(formData, ["name", "email", "password", "username", "consent"]);
  const values = { name: raw.name ?? "", email: raw.email ?? "", username: raw.username ?? "" };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error, values);
  if (!isSupabaseConfigured()) return formError(UNAVAILABLE_MESSAGE, values);

  const ip = await clientIp();
  const blocked = await enforceLimits(
    [[rateLimitKey("register:ip", ip), RATE_LIMITS.registerByIp]],
    values,
  );
  if (blocked) return blocked;

  const { name, email, password, username } = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { data: available, error: availabilityError } = await supabase.rpc("is_username_available", {
    p_username: username,
  });
  if (availabilityError) {
    logger.error("auth.register.availability_failed", { error: availabilityError.message });
    return formError(UNAVAILABLE_MESSAGE, values);
  }
  if (!available) {
    return { status: "error", fieldErrors: { username: "This username isn't available." }, values };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: callbackUrl(),
      data: {
        display_name: name,
        username,
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
      },
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return {
        status: "error",
        fieldErrors: { password: "That password is too easy to guess. Please choose another." },
        values,
      };
    }
    if (error.code === "email_address_invalid") {
      return {
        status: "error",
        fieldErrors: { email: "We can't send email to this address. Please use a different one." },
        values,
      };
    }
    // Same response as a new signup, so that this form can't reveal who has an account.
    if (error.code === "user_already_exists" || error.code === "email_exists") {
      return { status: "success", code: "check_email", email };
    }
    if (error.code === "over_email_send_rate_limit") {
      logger.error("auth.register.email_limit_reached", { code: error.code });
      return formError("We can't send any more confirmation emails right now. Please try again in about an hour.", values);
    }
    if (error.status === 429) {
      return formError("Too many attempts. Please try again later.", values);
    }
    logger.error("auth.register.failed", { code: error.code, status: error.status });
    return formError(UNAVAILABLE_MESSAGE, values);
  }

  // Only happens if "Confirm email" is turned off for this Supabase project.
  if (data.session) redirect("/onboarding");

  return { status: "success", code: "check_email", email };
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formValues(formData, ["email", "password", "next"]);
  const values = { email: raw.email ?? "" };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error, values);
  if (!isSupabaseConfigured()) return formError(UNAVAILABLE_MESSAGE, values);

  const { email, password } = parsed.data;
  const ip = await clientIp();
  const blocked = await enforceLimits(
    [
      [rateLimitKey("login:ip", ip), RATE_LIMITS.loginByIp],
      [rateLimitKey("login:email", email), RATE_LIMITS.loginByEmail],
    ],
    values,
  );
  if (blocked) return blocked;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Supabase only reports this after checking the password, so it reveals nothing to a stranger.
    if (error.code === "email_not_confirmed") {
      return {
        status: "error",
        code: "email_not_confirmed",
        email,
        message: "Please confirm your email address before logging in.",
        values,
      };
    }
    if (error.code !== "invalid_credentials") {
      logger.error("auth.login.failed", { code: error.code, status: error.status });
      return formError(UNAVAILABLE_MESSAGE, values);
    }
    // Shown for every failed login, so it says nothing about whether this address has an account.
    const hint = isGoogleAuthEnabled() ? " If you signed up with Google, use Continue with Google." : "";
    return formError(`Incorrect email or password.${hint}`, values);
  }

  redirect(safeRedirectPath(raw.next));
}

export async function signInWithGoogleAction(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured()) redirect("/login?error=oauth");

  const result = await checkRateLimits([[rateLimitKey("oauth:ip", await clientIp()), RATE_LIMITS.oauthByIp]]);
  if (result.status !== "allowed") redirect("/login?error=oauth");

  const next = safeRedirectPath(formData.get("next"));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl(next),
      // Without this, someone signed in to Google is logged straight back in after logging out,
      // with no chance to choose another account. Important on shared devices.
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data.url) {
    logger.error("auth.oauth.failed", { code: error?.code, status: error?.status });
    redirect("/login?error=oauth");
  }
  redirect(data.url);
}

export async function signOutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();
    if (error) logger.warn("auth.signout.failed", { code: error.code, status: error.status });
  }
  // Which page was being edited belongs to this person, not to the browser.
  (await cookies()).delete(ACTIVE_PROFILE_COOKIE);
  redirect("/");
}

export async function requestPasswordResetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = emailOnlySchema.safeParse(formValues(formData, ["email"]));
  if (!parsed.success) return validationError(parsed.error);
  if (!isSupabaseConfigured()) return formError(UNAVAILABLE_MESSAGE);

  const { email } = parsed.data;
  const blocked = await enforceLimits(
    [
      [rateLimitKey("reset:ip", await clientIp()), RATE_LIMITS.emailByIp],
      [rateLimitKey("reset:email", email), RATE_LIMITS.emailByAddress],
    ],
    { email },
  );
  if (blocked) return blocked;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: callbackUrl("/reset-password"),
  });
  // Logged but never shown: the response must be identical whether or not the account exists.
  if (error) logger.error("auth.reset_request.failed", { code: error.code, status: error.status });

  return {
    status: "success",
    message: "If an account exists for that address, we've sent a link to reset the password.",
  };
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse(formValues(formData, ["password", "confirmPassword"]));
  if (!parsed.success) return validationError(parsed.error);
  if (!isSupabaseConfigured()) return formError(UNAVAILABLE_MESSAGE);

  // Requires the short-lived marker set by the emailed link. Without it, anyone holding
  // an unlocked session could set a new password without knowing the current one.
  const cookieStore = await cookies();
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || cookieStore.get(RECOVERY_COOKIE)?.value !== userData.user.id) {
    return formError("This reset link has expired. Please request a new one.");
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") {
      return { status: "error", fieldErrors: { password: "Choose a password you haven't used here before." } };
    }
    if (error.code === "weak_password") {
      return { status: "error", fieldErrors: { password: "That password is too easy to guess. Please choose another." } };
    }
    logger.error("auth.reset.failed", { code: error.code, status: error.status });
    return formError(UNAVAILABLE_MESSAGE);
  }

  cookieStore.delete(RECOVERY_COOKIE);
  // Whoever prompted this reset may have been locked out by someone else's session.
  const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });
  if (signOutError) logger.warn("auth.reset.signout_others_failed", { code: signOutError.code });

  redirect("/dashboard");
}

export async function resendVerificationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = emailOnlySchema.safeParse(formValues(formData, ["email"]));
  if (!parsed.success) return validationError(parsed.error);
  if (!isSupabaseConfigured()) return formError(UNAVAILABLE_MESSAGE);

  const { email } = parsed.data;
  const blocked = await enforceLimits([
    [rateLimitKey("resend:ip", await clientIp()), RATE_LIMITS.emailByIp],
    [rateLimitKey("resend:email", email), RATE_LIMITS.emailByAddress],
  ]);
  if (blocked) return blocked;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: callbackUrl() },
  });
  if (error) logger.error("auth.resend.failed", { code: error.code, status: error.status });

  return { status: "success", message: "If that address needs confirming, we've sent a new link." };
}
