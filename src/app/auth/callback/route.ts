import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { RECOVERY_COOKIE, RECOVERY_COOKIE_MAX_AGE_SECONDS } from "@/features/auth/constants";
import { getAppUrl, isSupabaseConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { safeRedirectPath } from "@/lib/security/safe-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const EMAIL_LINK_TYPES: ReadonlySet<string> = new Set<EmailOtpType>(["signup", "email", "recovery", "email_change"]);

/** Completes Google sign-in (`code`) and email links (`token_hash` and `type`). */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  // The canonical origin from config, never the request's Host header, which a client controls.
  const toApp = (path: string) => NextResponse.redirect(new URL(path, getAppUrl()));
  const failure = () => toApp("/login?error=auth_callback");

  if (!isSupabaseConfigured()) return failure();

  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  const supabase = await createSupabaseServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      logger.warn("auth.callback.code_failed", { code: error.code, status: error.status });
      return failure();
    }
    return toApp(safeRedirectPath(params.get("next")));
  }

  if (tokenHash && type && EMAIL_LINK_TYPES.has(type)) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    if (error) {
      logger.warn("auth.callback.otp_failed", { code: error.code, status: error.status, type });
      return failure();
    }

    if (type === "recovery" && data.user) {
      const cookieStore = await cookies();
      cookieStore.set(RECOVERY_COOKIE, data.user.id, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: RECOVERY_COOKIE_MAX_AGE_SECONDS,
      });
      return toApp("/reset-password");
    }
    return toApp(safeRedirectPath(params.get("next")));
  }

  return failure();
}
