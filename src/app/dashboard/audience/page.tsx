import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOnboardedUser } from "@/features/auth/session";
import { deleteLeadAction } from "@/features/leads/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Audience" };

const PAGE_SIZE = 100;
const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

type Lead = {
  id: string;
  kind: "newsletter" | "contact";
  email: string;
  name: string | null;
  message: string | null;
  consent_text: string;
  created_at: string;
};

export default async function AudiencePage() {
  const { profile } = await requireOnboardedUser("/dashboard/audience");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("leads")
    .select("id, kind, email, name, message, consent_text, created_at")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  if (error) throw new Error(`Could not load audience: ${error.message}`);
  const leads = data as Lead[];

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Audience</h1>
        <p className="text-sm text-muted-foreground">People who signed up or messaged you through your page. Only you can see this.</p>
      </div>

      {leads.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No one yet</CardTitle>
            <CardDescription>Add a newsletter or contact form under Links, then publish your page.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {leads.map((lead) => (
            <li key={lead.id}>
              <Card>
                <CardContent className="flex items-start gap-3">
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium break-all">{lead.name ? `${lead.name} · ` : ""}{lead.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {lead.kind === "newsletter" ? "Newsletter" : "Contact form"} · {DATE_FORMAT.format(new Date(lead.created_at))}
                    </p>
                    {lead.message ? <p className="mt-2 break-words whitespace-pre-line">{lead.message}</p> : null}
                    <p className="mt-2 text-xs text-muted-foreground">Agreed: &ldquo;{lead.consent_text}&rdquo;</p>
                  </div>
                  <form action={deleteLeadAction}>
                    <input type="hidden" name="id" value={lead.id} />
                    <Button type="submit" size="icon-sm" variant="ghost" aria-label={`Delete ${lead.email}`}>
                      <Trash2 aria-hidden />
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {leads.length === PAGE_SIZE ? <p className="text-xs text-muted-foreground">Showing the latest {PAGE_SIZE}.</p> : null}
    </div>
  );
}
