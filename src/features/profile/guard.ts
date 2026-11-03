import "server-only";

import { checkRateLimits, RATE_LIMITS, rateLimitKey, type RateLimitRule } from "@/lib/security/rate-limit";
import type { ActionResult } from "./result";

/** Returns a failure when a user has made too many changes, or null when they may continue. */
export async function limitUser(
  userId: string,
  scope: string = "content",
  rule: RateLimitRule = RATE_LIMITS.contentWriteByUser,
): Promise<ActionResult<never> | null> {
  const result = await checkRateLimits([[rateLimitKey(`${scope}:user`, userId), rule]]);
  if (result.status === "allowed") return null;
  if (result.status === "limited") {
    return { ok: false, code: "rate_limited", message: "You're making changes too quickly. Please wait a moment." };
  }
  return { ok: false, message: "We can't save changes right now. Please try again in a moment." };
}
