import "server-only";

import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { hasCurrentConsent } from "@/features/legal/versions";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ACTIVE_PROFILE_COOKIE } from "./constants";

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
  analytics_enabled: boolean;
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
  const [account, profiles, cookieStore] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, display_name, status, terms_accepted_version, privacy_accepted_version")
      .eq("id", userId)
      .single<Account>(),
    supabase
      .from("profiles")
      .select(
        "id, username, display_name, status, bio, avatar_path, cover_path, category, theme, version, is_indexable, analytics_enabled, onboarding_completed_at, username_changed_at",
      )
      .eq("owner_id", userId)
      .order("created_at")
      .returns<Profile[]>(),
    cookies(),
  ]);

  // Surface these to the error boundary. Treating a failed read as "no profile"
  // would wrongly send an existing user back through onboarding.
  if (account.error) throw new Error(`Could not load account: ${account.error.message}`);
  if (profiles.error) throw new Error(`Could not load profile: ${profiles.error.message}`);

  // The cookie is only a preference. It selects among the pages RLS already limited to this user.
  const activeId = cookieStore.get(ACTIVE_PROFILE_COOKIE)?.value;
  const profile = profiles.data.find((item) => item.id === activeId) ?? profiles.data[0] ?? null;
  return { account: account.data, profile, profiles: profiles.data };
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

export type StaffRole = "admin" | "moderator";

/**
 * Gate for the admin area. Non-staff get a plain not-found, which doesn't confirm that it exists.
 * Checked under the user's own session, before any privileged client is touched.
 */
export async function requireStaff(options: { adminOnly?: boolean } = {}): Promise<{ user: User; role: StaffRole }> {
  const user = await requireUser("/admin");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("admin_roles").select("role").eq("user_id", user.id).maybeSingle<{ role: StaffRole }>();
  if (error || !data) notFound();
  if (options.adminOnly && data.role !== "admin") notFound();
  return { user, role: data.role };
}
