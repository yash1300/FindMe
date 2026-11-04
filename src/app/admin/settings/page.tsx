import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "@/features/admin/components/settings-form";
import { requireStaff } from "@/features/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  await requireStaff({ adminOnly: true });
  const { data, error } = await createSupabaseAdminClient().from("platform_settings").select("key, value");
  if (error) throw new Error(`Could not load settings: ${error.message}`);
  const value = (key: string) => data.find((row) => row.key === key)?.value;

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <Card>
        <CardHeader><CardTitle>Platform</CardTitle></CardHeader>
        <CardContent><SettingsForm maxProfiles={Number(value("max_profiles_per_account") ?? 5)} announcement={String(value("announcement") ?? "")} /></CardContent>
      </Card>
    </div>
  );
}
