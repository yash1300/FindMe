import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOnboardedUser, getAccountContext } from "@/features/auth/session";
import { CreatePageForm, DeletePageForm } from "@/features/profile/components/page-forms";
import { switchPageAction } from "@/features/profile/manage-actions";
import { getAppUrl } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pages" };

export default async function PagesPage() {
  const { user, profile: active } = await requireOnboardedUser("/dashboard/pages");
  const { profiles } = await getAccountContext(user.id);
  const baseUrl = getAppUrl();
  const host = baseUrl.replace(/^https?:\/\//, "");

  const supabase = await createSupabaseServerClient();
  const { data: limit } = await supabase.from("platform_settings").select("value").eq("key", "max_profiles_per_account").maybeSingle<{ value: number }>();
  const max = Number(limit?.value ?? 1);

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Pages</h1>
        <p className="text-sm text-muted-foreground">Each page has its own link, content, look and analytics. You&apos;re using {profiles.length} of {max}.</p>
      </div>

      <ul className="grid gap-3">
        {profiles.map((item) => (
          <li key={item.id}>
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {item.display_name}
                  {item.id === active.id ? <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">Current</span> : null}
                </CardTitle>
                <CardDescription className="break-all">{host}/{item.username} · {item.status}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                {item.id !== active.id ? (
                  <form action={switchPageAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <Button type="submit" variant="outline" size="sm">Work on this page</Button>
                  </form>
                ) : null}
                {profiles.length > 1 ? (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted-foreground">Delete this page</summary>
                    <div className="mt-3"><DeletePageForm id={item.id} username={item.username} /></div>
                  </details>
                ) : null}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      {profiles.length < max ? (
        <Card>
          <CardHeader>
            <CardTitle>Create another page</CardTitle>
            <CardDescription>It starts as a private draft.</CardDescription>
          </CardHeader>
          <CardContent><CreatePageForm baseUrl={baseUrl} /></CardContent>
        </Card>
      ) : null}
    </div>
  );
}
