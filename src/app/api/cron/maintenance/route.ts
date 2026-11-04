import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const UNVERIFIED_MAX_AGE_DAYS = 30;
const MAX_PAGES = 20;

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Fails closed: with no secret set, nobody can run this.
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Daily tidy-up. Called by Vercel Cron, with the secret it sends automatically. */
export async function GET(request: NextRequest) {
  if (!authorised(request)) return new NextResponse(null, { status: 401 });

  const admin = createSupabaseAdminClient();
  const cutoff = Date.now() - UNVERIFIED_MAX_AGE_DAYS * 86_400_000;
  let removedAccounts = 0;
  let removedEvents = 0;

  // Accounts that never confirmed their email, and so never used FindMe, release their usernames.
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      logger.error("cron.list_users_failed", { message: error.message });
      break;
    }
    for (const user of data.users) {
      if (!user.email_confirmed_at && !user.last_sign_in_at && new Date(user.created_at).getTime() < cutoff) {
        const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
        if (deleteError) logger.error("cron.delete_user_failed", { message: deleteError.message });
        else removedAccounts += 1;
      }
    }
    if (data.users.length < 1000) break;
  }

  for (let batch = 0; batch < 50; batch += 1) {
    const { data, error } = await admin.rpc("purge_expired_analytics");
    if (error) {
      logger.error("cron.purge_failed", { code: error.code });
      break;
    }
    removedEvents += Number(data ?? 0);
    if (Number(data ?? 0) < 1000) break;
  }

  logger.info("cron.maintenance_done", { removedAccounts, removedEvents });
  return NextResponse.json({ removedAccounts, removedEvents }, { headers: { "Cache-Control": "no-store" } });
}
