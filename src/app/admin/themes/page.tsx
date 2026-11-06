import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { removeSharedThemeAsStaffAction } from "@/features/admin/actions";
import { ReasonActionForm } from "@/features/admin/components/action-form";
import { requireStaff } from "@/features/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Shared themes" };

type SharedTheme = { id: string; owner_id: string; name: string; use_count: number; created_at: string };

/** Newest first, since a theme's name is the only thing in it that a person writes. */
export default async function AdminThemesPage() {
  await requireStaff();
  const { data, error } = await createSupabaseAdminClient()
    .from("shared_themes")
    .select("id, owner_id, name, use_count, created_at")
    .eq("status", "listed")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Could not load shared themes: ${error.message}`);
  const themes = data as SharedTheme[];

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Shared themes</h1>
        <p className="text-sm text-muted-foreground">Themes in the gallery. Remove any with an offensive or misleading name. Removals are logged.</p>
      </div>
      {themes.length === 0 ? <p className="text-sm text-muted-foreground">No themes have been shared.</p> : null}
      <ul className="grid gap-3">
        {themes.map((theme) => (
          <li key={theme.id}>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{theme.name}</CardTitle>
                <CardDescription>
                  Shared {new Date(theme.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} · used{" "}
                  {theme.use_count.toLocaleString("en-IN")} times ·{" "}
                  <Link href={`/admin/users/${theme.owner_id}`} prefetch={false} className="underline">view creator</Link>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ReasonActionForm action={removeSharedThemeAsStaffAction} hidden={{ theme: theme.id }} label="Remove from gallery" destructive />
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
