import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { FormSkeleton } from "@/components/forms/form-skeleton";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCount } from "@/features/analytics/summary";
import { requireUser } from "@/features/auth/session";
import { logger } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

type Overview = {
  registered_users: number;
  active_users: number;
  suspended_users: number;
  published_profiles: number;
  total_views: number;
  total_clicks: number;
};

async function AdminContent() {
  const user = await requireUser("/admin");

  // Checked under the user's own session, before the privileged client is touched. Everyone
  // else gets a plain 404-style page, which doesn't confirm that an admin area exists.
  const supabase = await createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.from("admin_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (roleError) {
    logger.error("admin.role_check_failed", { code: roleError.code });
    notFound();
  }
  if (!role) notFound();

  const { data, error } = await createSupabaseAdminClient().rpc("admin_overview");
  if (error) throw new Error(`Could not load admin figures: ${error.message}`);
  const overview = data as Overview;

  const figures = [
    { label: "Registered users", value: overview.registered_users, testId: "admin-registered" },
    { label: "Active users", value: overview.active_users, testId: "admin-active" },
    { label: "Suspended users", value: overview.suspended_users, testId: "admin-suspended" },
    { label: "Published pages", value: overview.published_profiles, testId: "admin-published" },
    { label: "Total views", value: overview.total_views, testId: "admin-views" },
    { label: "Total clicks", value: overview.total_clicks, testId: "admin-clicks" },
  ];

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Admin overview</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {figures.map((figure) => (
          <Card key={figure.label}>
            <CardHeader>
              <CardDescription>{figure.label}</CardDescription>
              <CardTitle className="text-3xl" data-testid={figure.testId}>{formatCount(figure.value)}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
    </>
  );
}

export default function AdminPage() {
  return (
    <main className="mx-auto grid w-full max-w-5xl content-start gap-6 p-6 sm:p-10">
      <Logo prefetch={false} />
      <Suspense fallback={<FormSkeleton />}>
        <AdminContent />
      </Suspense>
    </main>
  );
}
