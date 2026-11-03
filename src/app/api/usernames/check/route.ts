import { type NextRequest, NextResponse } from "next/server";
import { usernameSchema } from "@/features/usernames/schema";
import { isSupabaseConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getClientIp } from "@/lib/security/client-ip";
import { checkRateLimit, RATE_LIMITS, rateLimitKey } from "@/lib/security/rate-limit";
import { createSupabaseAnonClient } from "@/lib/supabase/server";

const NO_STORE = { "Cache-Control": "no-store" };

function errorResponse(status: number, code: string, message: string, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { ...NO_STORE, ...extraHeaders } });
}

export async function GET(request: NextRequest) {
  const parsed = usernameSchema.safeParse(request.nextUrl.searchParams.get("username") ?? "");
  if (!parsed.success) {
    return NextResponse.json(
      { available: false, reason: "invalid", message: parsed.error.issues[0].message },
      { headers: NO_STORE },
    );
  }

  if (!isSupabaseConfigured()) {
    return errorResponse(503, "unavailable", "Username checks are unavailable right now.");
  }

  const limit = await checkRateLimit(
    rateLimitKey("username_check:ip", getClientIp(request.headers)),
    RATE_LIMITS.usernameCheckByIp,
  );
  if (limit.status === "limited") {
    return errorResponse(429, "rate_limited", "Too many checks. Please slow down.", {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }
  if (limit.status === "unavailable") {
    return errorResponse(503, "unavailable", "Username checks are unavailable right now.");
  }

  const { data, error } = await createSupabaseAnonClient().rpc("is_username_available", {
    p_username: parsed.data,
  });
  if (error) {
    logger.error("usernames.check_failed", { code: error.code });
    return errorResponse(503, "unavailable", "Username checks are unavailable right now.");
  }

  return NextResponse.json(
    data ? { available: true, username: parsed.data } : { available: false, reason: "taken" },
    { headers: NO_STORE },
  );
}
