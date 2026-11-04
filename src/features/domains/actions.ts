"use server";

import { resolveTxt } from "node:dns/promises";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfileOwner } from "@/features/auth/session";
import { limitUser } from "@/features/profile/guard";
import { type ActionResult, failure } from "@/features/profile/result";
import { getAppUrl } from "@/lib/env";
import { logger } from "@/lib/logger";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeHostname, txtRecordsContain, verificationRecordName } from "./host";
import { addDomainToHosting, removeDomainFromHosting } from "./vercel";

const MAX_DOMAINS_PER_PAGE = 3;
const idSchema = z.uuid();

export async function addDomainAction(input: { hostname: string }): Promise<ActionResult> {
  const { user, profile } = await requireProfileOwner();

  const hostname = normalizeHostname(input.hostname, getAppUrl());
  if (!hostname) {
    const message = "Enter a domain you own, like links.yourname.com.";
    return failure(message, { hostname: message });
  }

  const limited = await limitUser(user.id, "domain", RATE_LIMITS.claimByUser);
  if (limited) return limited;

  const supabase = await createSupabaseServerClient();
  const { count } = await supabase.from("custom_domains").select("id", { count: "exact", head: true }).eq("profile_id", profile.id);
  if ((count ?? 0) >= MAX_DOMAINS_PER_PAGE) return failure(`A page can have up to ${MAX_DOMAINS_PER_PAGE} domains.`);

  const { error } = await supabase.from("custom_domains").insert({ profile_id: profile.id, hostname });
  if (error) {
    if (error.code === "23505") {
      const message = "That domain is already connected to a page.";
      return failure(message, { hostname: message });
    }
    logger.error("domains.add_failed", { code: error.code });
    return failure();
  }
  revalidatePath("/dashboard/domains");
  return { ok: true };
}

/** Checks the DNS record proving ownership. Only this server code can change a domain's status. */
export async function verifyDomainAction(id: string): Promise<ActionResult<{ status: string; message: string }>> {
  const { user, profile } = await requireProfileOwner();
  if (!idSchema.safeParse(id).success) return failure();

  const limited = await limitUser(user.id, "domain_verify", RATE_LIMITS.claimByUser);
  if (limited) return limited;

  // Read under the user's session, so RLS confirms that this domain is theirs.
  const supabase = await createSupabaseServerClient();
  const { data: domain } = await supabase
    .from("custom_domains")
    .select("id, hostname, verification_token")
    .eq("id", id)
    .eq("profile_id", profile.id)
    .maybeSingle<{ id: string; hostname: string; verification_token: string }>();
  if (!domain) return failure("That domain no longer exists.");

  let records: string[][] = [];
  try {
    records = await resolveTxt(verificationRecordName(domain.hostname));
  } catch {
    // Not found yet. DNS changes can take a while to spread.
  }

  const admin = createSupabaseAdminClient();
  const save = async (status: string, lastError: string | null, verified: boolean) => {
    const { error } = await admin
      .from("custom_domains")
      .update({ status, last_error: lastError, ...(verified ? { verified_at: new Date().toISOString() } : {}) })
      .eq("id", domain.id);
    if (error) logger.error("domains.status_failed", { code: error.code });
  };

  if (!txtRecordsContain(records, domain.verification_token)) {
    const message = "We couldn't find the verification record yet. DNS changes can take up to a few hours, so try again later.";
    await save("failed", message, false);
    revalidatePath("/dashboard/domains");
    return { ok: true, status: "failed", message };
  }

  const hosting = await addDomainToHosting(domain.hostname);
  if (hosting === "connected") {
    await save("active", null, true);
    revalidatePath("/dashboard/domains");
    return { ok: true, status: "active", message: "Your domain is connected. HTTPS can take a few minutes to start working." };
  }

  const message = hosting === "not_configured"
    ? "Ownership confirmed. FindMe still needs to finish connecting custom domains on our side, so your domain isn't live yet."
    : "Ownership confirmed, but we couldn't finish connecting your domain. Please try again.";
  await save("verified", message, true);
  revalidatePath("/dashboard/domains");
  return { ok: true, status: "verified", message };
}

export async function removeDomainAction(id: string): Promise<ActionResult> {
  const { user, profile } = await requireProfileOwner();
  if (!idSchema.safeParse(id).success) return failure();

  const limited = await limitUser(user.id);
  if (limited) return limited;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("custom_domains")
    .delete()
    .eq("id", id)
    .eq("profile_id", profile.id)
    .select("hostname")
    .maybeSingle<{ hostname: string }>();
  if (error) {
    logger.error("domains.remove_failed", { code: error.code });
    return failure();
  }
  if (data) await removeDomainFromHosting(data.hostname);
  revalidatePath("/dashboard/domains");
  return { ok: true };
}
