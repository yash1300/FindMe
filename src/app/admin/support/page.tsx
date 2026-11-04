import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStaff } from "@/features/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Messages" };

export default async function AdminSupportPage() {
  await requireStaff();
  const { data, error } = await createSupabaseAdminClient()
    .from("contact_submissions")
    .select("id, name, email, message, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Could not load messages: ${error.message}`);

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
      <p className="text-sm text-muted-foreground">From the Contact page. Reply by email.</p>
      {(data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No messages yet.</p> : null}
      <ul className="grid gap-3">
        {(data ?? []).map((row) => (
          <li key={row.id}>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm break-all">{row.name} · <a href={`mailto:${encodeURIComponent(row.email).replace("%40", "@")}`} className="underline">{row.email}</a></CardTitle>
                <CardDescription>{new Date(row.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</CardDescription>
              </CardHeader>
              <CardContent><p className="whitespace-pre-line break-words text-sm">{row.message}</p></CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
