import "server-only";

import { createHash } from "node:crypto";
import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RateLimitRule = { limit: number; windowSeconds: number };

export const RATE_LIMITS = {
  loginByIp: { limit: 20, windowSeconds: 300 },
  loginByEmail: { limit: 8, windowSeconds: 300 },
  registerByIp: { limit: 10, windowSeconds: 3600 },
  emailByIp: { limit: 10, windowSeconds: 3600 },
  emailByAddress: { limit: 3, windowSeconds: 900 },
  oauthByIp: { limit: 30, windowSeconds: 300 },
  usernameCheckByIp: { limit: 60, windowSeconds: 60 },
  claimByUser: { limit: 20, windowSeconds: 300 },
  credentialChangeByUser: { limit: 8, windowSeconds: 900 },
  contentWriteByUser: { limit: 300, windowSeconds: 300 },
  uploadByUser: { limit: 40, windowSeconds: 3600 },
  analyticsByIp: { limit: 120, windowSeconds: 60 },
  leadByIp: { limit: 20, windowSeconds: 3600 },
  leadByIpAndBlock: { limit: 5, windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitResult =
  | { status: "allowed" }
  | { status: "limited"; retryAfterSeconds: number }
  | { status: "unavailable" };

/** Keys are hashed so that emails and IPs are never stored in the bucket table. */
export function rateLimitKey(scope: string, identifier: string): string {
  const digest = createHash("sha256").update(identifier.trim().toLowerCase()).digest("hex");
  return `${scope}:${digest}`;
}

/**
 * Fails closed: if the limiter cannot be reached the result is "unavailable", and callers
 * must refuse the request. These endpoints all depend on the same database anyway.
 */
export async function checkRateLimit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  try {
    const { data, error } = await createSupabaseAdminClient().rpc("check_rate_limit", {
      p_key: key,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    });
    if (error) throw error;

    const row = (Array.isArray(data) ? data[0] : data) as
      | { allowed: boolean; retry_after_seconds: number }
      | undefined;
    if (!row) throw new Error("check_rate_limit returned no row");

    return row.allowed
      ? { status: "allowed" }
      : { status: "limited", retryAfterSeconds: row.retry_after_seconds };
  } catch (error) {
    logger.error("rate_limit.unavailable", { error });
    return { status: "unavailable" };
  }
}

/** Checks every rule, so that each counter still counts, and returns the most restrictive result. */
export async function checkRateLimits(
  checks: ReadonlyArray<readonly [key: string, rule: RateLimitRule]>,
): Promise<RateLimitResult> {
  const results = await Promise.all(checks.map(([key, rule]) => checkRateLimit(key, rule)));
  if (results.some((result) => result.status === "unavailable")) return { status: "unavailable" };

  const limited = results.flatMap((result) => (result.status === "limited" ? [result] : []));
  if (limited.length > 0) {
    return { status: "limited", retryAfterSeconds: Math.max(...limited.map((r) => r.retryAfterSeconds)) };
  }
  return { status: "allowed" };
}
