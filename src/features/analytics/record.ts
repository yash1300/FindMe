import "server-only";

import { logger } from "@/lib/logger";
import { getClientIp } from "@/lib/security/client-ip";
import { checkRateLimit, RATE_LIMITS, rateLimitKey } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { browserCategory, countryCode, deviceCategory, hasOptedOut, isBot, osCategory, referrerCategory } from "./classify";

type EventInput = {
  headers: Pick<Headers, "get">;
  profileId: string;
  blockId?: string;
  type: "view" | "click";
  referrer?: unknown;
};

/**
 * Records a visit. Bots, and people signalling they don't want to be tracked, are skipped. Failures
 * are logged and swallowed, because analytics must never get in the way of the page or the link.
 */
export async function recordAnalyticsEvent({ headers, profileId, blockId, type, referrer }: EventInput): Promise<void> {
  try {
    const userAgent = headers.get("user-agent");
    if (isBot(userAgent) || hasOptedOut(headers)) return;

    const ip = getClientIp(headers);
    const limit = await checkRateLimit(rateLimitKey("analytics:ip", ip), RATE_LIMITS.analyticsByIp);
    if (limit.status !== "allowed") return;

    const agent = userAgent as string;
    const { error } = await createSupabaseAdminClient().rpc("record_analytics_event", {
      p_profile_id: profileId,
      p_block_id: blockId ?? null,
      p_event_type: type,
      // Goes only into a salted hash in the database. It's never stored as it is.
      p_visitor_source: `${ip}|${agent}`,
      p_referrer: type === "view" ? referrerCategory(referrer, headers.get("host")) : null,
      p_device: type === "view" ? deviceCategory(agent) : null,
      p_browser: type === "view" ? browserCategory(agent) : null,
      p_os: type === "view" ? osCategory(agent) : null,
      p_country: type === "view" ? countryCode(headers.get("x-vercel-ip-country")) : null,
    });
    if (error) logger.error("analytics.record_failed", { code: error.code });
  } catch (error) {
    logger.error("analytics.record_failed", { error });
  }
}
