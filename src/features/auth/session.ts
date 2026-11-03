import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { hasCurrentConsent } from "@/features/legal/versions";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Account = {
  id: string;
  display_name: string;
  status: "active" | "suspended";
  terms_accepted_version: string | null;
  privacy_accepted_version: string | null;
};

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  status: "draft" | "published" | "unpublished" | "suspended";
  bio: string | null;
  avatar_path: string | null;
  cover_path: string | null;
  category: string | null;
  theme: unknown;
  version: number;
  is_indexable: boolean;
  onboarding_completed_at: string | null;
  username_changed_at: string | null;
};

/** Uses getUser, which validates the token with Supabase, rather than trusting the session cookie. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  // Wait for a real request. Otherwise a build with missing env would prerender the signed-out
  // result into a static page, and prefetch passes would run the auth client's expiry checks,
  // which read the clock during prerendering.
  await connection();
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
});

export async function requireUser(returnTo: string = "/dashboard"): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}

export const getAccountContext = cache(async (userId: string) => {
  const supabase = await createSupabaseServerClient();
  const [account, profile] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, display_name, status, terms_accepted_version, privacy_accepted_version")
      .eq("id", userId)
      .single<Account>(),
    supabase
      .from("profiles")
      .select(
        "id, username, display_name, status, bio, avatar_path, cover_path, category, theme, version, is_indexable, onboarding_completed_at, username_changed_at",
      )
      .eq("owner_id", userId)
      .order("created_at")
      .limit(1)
      .maybeSingle<Profile>(),
  ]);

  // Surface these to the error boundary. Treating a failed read as "no profile"
  // would wrongly send an existing user back through onboarding.
  if (account.error) throw new Error(`Could not load account: ${account.error.message}`);
  if (profile.error) throw new Error(`Could not load profile: ${profile.error.message}`);
  return { account: account.data, profile: profile.data };
});

/** For pages that need a finished, active account. Sends everyone else to the right place. */
export async function requireOnboardedUser(returnTo: string = "/dashboard") {
  const user = await requireUser(returnTo);
  const { account, profile } = await getAccountContext(user.id);

  if (account.status === "suspended") redirect("/suspended");
  if (!profile || !hasCurrentConsent(account) || !profile.onboarding_completed_at) redirect("/onboarding");

  return { user, account, profile };
}

/**
 * For anything that edits a page, including during onboarding. Actions call this themselves:
 * a page's own check doesn't protect an action, which can be invoked directly.
 */
export async function requireProfileOwner() {
  const user = await requireUser();
  const { account, profile } = await getAccountContext(user.id);

  if (account.status === "suspended") redirect("/suspended");
  if (!profile || !hasCurrentConsent(account)) redirect("/onboarding");

  return { user, account, profile };
}
