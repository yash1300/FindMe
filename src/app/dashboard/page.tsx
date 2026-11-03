import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOnboardedUser } from "@/features/auth/session";
import { getAppUrl } from "@/lib/env";

const STATUS_LABELS = {
  draft: "Draft",
  published: "Published",
  unpublished: "Unpublished",
  suspended: "Suspended",
} as const;

export default async function DashboardPage() {
  const { account, profile } = await requireOnboardedUser();
  const host = getAppUrl().replace(/^https?:\/\//, "");

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome, {account.display_name}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Your page</CardTitle>
          <CardDescription>Your username is reserved. Your page isn&apos;t public yet.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Link</p>
            <p className="font-medium break-all">
              {host}/{profile.username}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Status</p>
            <p className="font-medium">{STATUS_LABELS[profile.status]}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
