import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createSupabaseAnonClient } from "@/lib/supabase/server";

const NO_STORE = { "Cache-Control": "no-store" };
const DEGRADED = { status: "degraded", database: "unreachable" };

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(DEGRADED, { status: 503, headers: NO_STORE });
  }

  const { error } = await createSupabaseAnonClient()
    .from("public_profiles")
    .select("id", { head: true })
    .limit(1);

  if (error) {
    logger.error("health.database_unreachable", { code: error.code });
    return NextResponse.json(DEGRADED, { status: 503, headers: NO_STORE });
  }
  return NextResponse.json({ status: "ok", database: "ok" }, { headers: NO_STORE });
}
