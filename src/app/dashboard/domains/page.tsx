import type { Metadata } from "next";
import { requireOnboardedUser } from "@/features/auth/session";
import { DomainManager, type DomainRow } from "@/features/domains/components/domain-manager";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Domains" };

export default async function DomainsPage() {
  const { profile } = await requireOnboardedUser("/dashboard/domains");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("custom_domains")
    .select("id, hostname, status, verification_token, last_error")
    .eq("profile_id", profile.id)
    .order("created_at");
  if (error) throw new Error(`Could not load domains: ${error.message}`);

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Custom domains</h1>
        <p className="text-sm text-muted-foreground">Show @{profile.username} on your own web address. The page must be published for it to work.</p>
      </div>
      <DomainManager domains={data as DomainRow[]} />
    </div>
  );
}
