import type { Metadata } from "next";
import { requireStaff } from "@/features/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Audit log" };

export default async function AdminAuditPage() {
  await requireStaff();
  const { data, error } = await createSupabaseAdminClient()
    .from("audit_logs")
    .select("id, actor_id, action, target_type, target_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Could not load the audit log: ${error.message}`);

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">The latest 200 entries. This log is append-only, and entries can&apos;t be changed.</p>
      </div>
      {(data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nothing yet.</p> : null}
      <ul className="grid gap-2 text-sm">
        {(data ?? []).map((row) => (
          <li key={row.id} className="rounded-lg border bg-card p-3">
            <p><span className="font-medium">{row.action}</span> · {new Date(row.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
            <p className="break-all text-xs text-muted-foreground">By {row.actor_id ?? "system"} · {row.target_type} {row.target_id}</p>
            {row.metadata?.reason ? <p className="mt-1 break-words">{String(row.metadata.reason)}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
