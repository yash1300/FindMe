import { after, type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordAnalyticsEvent } from "@/features/analytics/record";
import { blockDestination } from "@/features/blocks/destination";
import { toRenderableBlock } from "@/features/blocks/schema";
import { isSupabaseConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createSupabaseAnonClient } from "@/lib/supabase/server";

const NOT_FOUND = () => new NextResponse("Link not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * Counts a click, then redirects. The destination only ever comes from the stored block, after being
 * validated again, and nothing in the request can influence it, so this can't be an open redirect.
 * Reading through public_blocks means hidden, expired and unpublished links don't work.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ blockId: string }> }) {
  const { blockId } = await params;
  if (!z.uuid().safeParse(blockId).success || !isSupabaseConfigured()) return NOT_FOUND();

  const { data, error } = await createSupabaseAnonClient()
    .from("public_blocks")
    .select("id, profile_id, type, config")
    .eq("id", blockId)
    .maybeSingle<{ id: string; profile_id: string; type: string; config: unknown }>();

  if (error) {
    logger.error("links.lookup_failed", { code: error.code });
    return new NextResponse("Something went wrong. Please try again.", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!data) return NOT_FOUND();

  const block = toRenderableBlock(data);
  const destination = block ? blockDestination(block) : null;
  if (!destination) return NOT_FOUND();

  const { headers } = request;
  after(() => recordAnalyticsEvent({ headers, profileId: data.profile_id, blockId: data.id, type: "click" }));

  const response = NextResponse.redirect(destination, 302);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex");
  return response;
}
