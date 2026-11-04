import { NextResponse } from "next/server";
import { getAccountContext, getCurrentUser } from "@/features/auth/session";
import { leadsToCsv, type LeadRow } from "@/features/leads/csv";
import { logger } from "@/lib/logger";
import { checkRateLimit, RATE_LIMITS, rateLimitKey } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** The current page's signups and messages as CSV. Under the user's session, so RLS limits it to their own. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { profile } = await getAccountContext(user.id);
  if (!profile) return new NextResponse(null, { status: 404 });

  const limit = await checkRateLimit(rateLimitKey("export:user", user.id), RATE_LIMITS.exportByUser);
  if (limit.status !== "allowed") return new NextResponse("Too many exports. Please try again later.", { status: 429 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("leads")
    .select("created_at, kind, email, name, message, consent_text, consent_at, custom_fields")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(50000);
  if (error) {
    logger.error("leads.export_failed", { code: error.code });
    return new NextResponse("We couldn't create that file. Please try again.", { status: 503 });
  }

  return new NextResponse(leadsToCsv(data as LeadRow[]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="findme-${profile.username}-audience.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
