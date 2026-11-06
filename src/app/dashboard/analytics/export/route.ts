import { type NextRequest, NextResponse } from "next/server";
import { blockNamer } from "@/features/analytics/block-name";
import { getDailyRows } from "@/features/analytics/queries";
import { analyticsCsv, parseRange, todayInIndia } from "@/features/analytics/summary";
import { requireOnboardedUser } from "@/features/auth/session";
import { getOwnerContent } from "@/features/profile/queries";
import { logger } from "@/lib/logger";

/** The selected page's daily figures for a date range, as a spreadsheet. Owners only: RLS limits the read. */
export async function GET(request: NextRequest) {
  const { profile } = await requireOnboardedUser("/dashboard/analytics");
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const range = parseRange(params, todayInIndia());

  try {
    const [rows, { blocks }] = await Promise.all([getDailyRows(profile.id, range.from, range.to), getOwnerContent(profile.id)]);
    const blockName = blockNamer(blocks);

    return new NextResponse(analyticsCsv(rows, blockName), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="findme-${profile.username}-${range.from}-to-${range.to}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    logger.error("analytics.export_failed", { message: error instanceof Error ? error.message : "unknown" });
    return new NextResponse("We couldn't prepare your download. Please try again.", { status: 500 });
  }
}
