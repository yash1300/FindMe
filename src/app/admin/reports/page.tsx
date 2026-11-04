import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { closeReportAction, hideBlockAction, setProfileSuspendedAction } from "@/features/admin/actions";
import { ReasonActionForm } from "@/features/admin/components/action-form";
import { requireStaff } from "@/features/auth/session";
import { reasonLabel } from "@/features/reports/reasons";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Reports" };

type Report = {
  id: string; profile_id: string | null; block_id: string | null; username_snapshot: string; reason: string;
  details: string | null; reporter_email: string | null; created_at: string;
};

export default async function AdminReportsPage() {
  await requireStaff();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("reports")
    .select("id, profile_id, block_id, username_snapshot, reason, details, reporter_email, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Could not load reports: ${error.message}`);
  const reports = data as Report[];

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Open reports</h1>
      {reports.length === 0 ? <p className="text-sm text-muted-foreground">Nothing to review.</p> : null}
      <ul className="grid gap-3">
        {reports.map((report) => (
          <li key={report.id}>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">@{report.username_snapshot} · {reasonLabel(report.reason)}{report.block_id ? " · one link" : ""}</CardTitle>
                <CardDescription>{new Date(report.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}{report.reporter_email ? ` · from ${report.reporter_email}` : ""}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                {report.details ? <p className="whitespace-pre-line break-words text-sm">{report.details}</p> : null}
                {report.profile_id ? (
                  <ReasonActionForm action={setProfileSuspendedAction} hidden={{ profile: report.profile_id, suspended: "true", report: report.id }} label="Suspend page" destructive />
                ) : null}
                {report.block_id ? (
                  <ReasonActionForm action={hideBlockAction} hidden={{ block: report.block_id, profile: report.profile_id ?? undefined, report: report.id }} label="Hide link" destructive />
                ) : null}
                <ReasonActionForm action={closeReportAction} hidden={{ report: report.id, status: "resolved" }} label="Mark resolved" />
                <ReasonActionForm action={closeReportAction} hidden={{ report: report.id, status: "dismissed" }} label="Dismiss" />
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
