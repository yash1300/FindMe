import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/session";
import { logger } from "@/lib/logger";
import { checkRateLimit, RATE_LIMITS, rateLimitKey } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Everything FindMe holds for this person. Read under their session, so RLS limits it to their own. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });

  const limit = await checkRateLimit(rateLimitKey("account_export:user", user.id), RATE_LIMITS.exportByUser);
  if (limit.status !== "allowed") return new NextResponse("Too many exports. Please try again later.", { status: 429 });

  const supabase = await createSupabaseServerClient();
  const tables = ["accounts", "profiles", "blocks", "social_links", "custom_domains", "leads", "analytics_daily"] as const;
  const results = await Promise.all(tables.map((table) => supabase.from(table).select("*").limit(100000)));

  const failed = results.find((result) => result.error);
  if (failed?.error) {
    logger.error("account.export_failed", { code: failed.error.code });
    return new NextResponse("We couldn't create that file. Please try again.", { status: 503 });
  }

  const body = {
    exported_at: new Date().toISOString(),
    login: { id: user.id, email: user.email, created_at: user.created_at, providers: user.identities?.map((identity) => identity.provider) ?? [] },
    ...Object.fromEntries(tables.map((table, index) => [table, results[index].data])),
  };

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="findme-my-data.json"',
      "Cache-Control": "no-store",
    },
  });
}
