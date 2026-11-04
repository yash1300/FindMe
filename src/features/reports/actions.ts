"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { type ActionState, formError, formValues, tooManyAttempts, UNAVAILABLE_MESSAGE, validationError } from "@/features/auth/action-state";
import { usernameSchema } from "@/features/usernames/schema";
import { isSupabaseConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getClientIp } from "@/lib/security/client-ip";
import { checkRateLimit, RATE_LIMITS, rateLimitKey } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import { emailAddressSchema } from "@/lib/urls";
import { REPORT_REASONS } from "./reasons";

const reportSchema = z.object({
  username: usernameSchema,
  reason: z.enum(REPORT_REASONS.map((item) => item.value) as [string, ...string[]], { error: "Choose a reason." }),
  blockId: z.union([z.literal("").transform(() => undefined), z.uuid()]).optional(),
  details: z.string().trim().max(2000, "Use at most 2000 characters.").optional(),
  email: z.union([z.literal("").transform(() => undefined), emailAddressSchema]).optional(),
});

export async function submitReportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = formValues(formData, ["username", "reason", "blockId", "details", "email", "website"]);
  const values = { details: raw.details ?? "", email: raw.email ?? "" };

  const parsed = reportSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error, values);
  if (raw.website) return { status: "success", message: "Thanks. We'll review this report." };
  if (!isSupabaseConfigured()) return formError(UNAVAILABLE_MESSAGE, values);

  const limit = await checkRateLimit(rateLimitKey("report:ip", getClientIp(await headers())), RATE_LIMITS.reportByIp);
  if (limit.status === "limited") return tooManyAttempts(limit.retryAfterSeconds, values);
  if (limit.status === "unavailable") return formError(UNAVAILABLE_MESSAGE, values);

  const anon = createSupabaseAnonClient();
  const { data: profile, error: profileError } = await anon
    .from("public_profiles")
    .select("id, username")
    .eq("username", parsed.data.username)
    .maybeSingle<{ id: string; username: string }>();
  if (profileError) {
    logger.error("reports.lookup_failed", { code: profileError.code });
    return formError(UNAVAILABLE_MESSAGE, values);
  }
  if (!profile) return formError("We couldn't find that page.", values);

  // A link is only recorded if it's really on this page.
  let blockId: string | null = null;
  if (parsed.data.blockId) {
    const { data: block } = await anon.from("public_blocks").select("id").eq("id", parsed.data.blockId).eq("profile_id", profile.id).maybeSingle<{ id: string }>();
    blockId = block?.id ?? null;
  }

  const { error } = await createSupabaseAdminClient().from("reports").insert({
    profile_id: profile.id,
    block_id: blockId,
    username_snapshot: profile.username,
    reason: parsed.data.reason,
    details: parsed.data.details || null,
    reporter_email: parsed.data.email ?? null,
  });
  if (error) {
    logger.error("reports.insert_failed", { code: error.code });
    return formError(UNAVAILABLE_MESSAGE, values);
  }
  return { status: "success", message: "Thanks. We'll review this report." };
}
