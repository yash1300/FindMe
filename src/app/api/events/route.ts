import { after, type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordAnalyticsEvent } from "@/features/analytics/record";
import { isSupabaseConfigured } from "@/lib/env";

const MAX_BODY_BYTES = 2048;

const bodySchema = z.object({
  profileId: z.uuid(),
  referrer: z.string().max(1024).optional(),
});

const NO_CONTENT = () => new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });

/** Page-view beacon. It runs after the page loads, so public pages can stay cached. */
export async function POST(request: NextRequest) {
  // Only the app's own pages may report views, which blocks casual inflation from other sites.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) {
    return new NextResponse(null, { status: 403 });
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  if (isSupabaseConfigured()) {
    const { headers } = request;
    // After the response, so a visitor's page never waits for analytics.
    after(() =>
      recordAnalyticsEvent({ headers, profileId: parsed.data.profileId, type: "view", referrer: parsed.data.referrer }),
    );
  }
  return NO_CONTENT();
}
