import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { setAccountStatusAction, setProfileSuspendedAction } from "@/features/admin/actions";
import { ReasonActionForm } from "@/features/admin/components/action-form";
import { requireStaff } from "@/features/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "User" };

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const admin = createSupabaseAdminClient();
  const [{ data: account }, { data: profiles }, { data: login }, { data: history }] = await Promise.all([
    admin.from("accounts").select("id, display_name, status, created_at").eq("id", id).maybeSingle(),
    admin.from("profiles").select("id, username, display_name, status").eq("owner_id", id).order("created_at"),
    admin.auth.admin.getUserById(id),
    admin.from("moderation_actions").select("id, action, reason, created_at").eq("target_id", id).order("created_at", { ascending: false }).limit(20),
  ]);
  if (!account) notFound();

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{account.display_name}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription className="break-all">{login.user?.email ?? "No email"} · <span data-testid="account-status">{account.status}</span></CardDescription>
        </CardHeader>
        <CardContent>
          <ReasonActionForm
            action={setAccountStatusAction}
            hidden={{ target: account.id, status: account.status === "suspended" ? "active" : "suspended" }}
            label={account.status === "suspended" ? "Restore account" : "Suspend account"}
            destructive={account.status !== "suspended"}
          />
        </CardContent>
      </Card>

      <h2 className="text-lg font-semibold">Pages</h2>
      <ul className="grid gap-3">
        {(profiles ?? []).map((profile) => (
          <li key={profile.id}>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">@{profile.username}</CardTitle>
                <CardDescription>{profile.status}</CardDescription>
              </CardHeader>
              <CardContent>
                <ReasonActionForm
                  action={setProfileSuspendedAction}
                  hidden={{ profile: profile.id, suspended: profile.status === "suspended" ? "false" : "true" }}
                  label={profile.status === "suspended" ? "Restore page" : "Suspend page"}
                  destructive={profile.status !== "suspended"}
                />
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      {(history ?? []).length > 0 ? (
        <>
          <h2 className="text-lg font-semibold">History</h2>
          <ul className="grid gap-1 text-sm">
            {(history ?? []).map((item) => (
              <li key={item.id}><span className="font-medium">{item.action}</span> · {item.reason} · {new Date(item.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
