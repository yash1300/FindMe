import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCount } from "@/features/analytics/summary";
import { requireStaff } from "@/features/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Overview = Record<"registered_users" | "active_users" | "suspended_users" | "published_profiles" | "total_views" | "total_clicks", number>;

export default async function AdminPage() {
  await requireStaff();
  const admin = createSupabaseAdminClient();
  const [{ data, error }, reports] = await Promise.all([
    admin.rpc("admin_overview"),
    admin.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  if (error) throw new Error(`Could not load admin figures: ${error.message}`);
  const overview = data as Overview;

  const figures = [
    { label: "Registered users", value: overview.registered_users, testId: "admin-registered" },
    { label: "Active users", value: overview.active_users, testId: "admin-active" },
    { label: "Suspended users", value: overview.suspended_users, testId: "admin-suspended" },
    { label: "Published pages", value: overview.published_profiles, testId: "admin-published" },
    { label: "Open reports", value: reports.count ?? 0, testId: "admin-reports" },
    { label: "Total views", value: overview.total_views, testId: "admin-views" },
    { label: "Total clicks", value: overview.total_clicks, testId: "admin-clicks" },
  ];

  return (
    <div className="grid gap-6">
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
    </div>
  );
}
