import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmailForm, NameForm, PasswordForm } from "@/features/accounts/components/settings-forms";
import { requireOnboardedUser } from "@/features/auth/session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, account } = await requireOnboardedUser("/dashboard/settings");
  const hasPassword = user.identities?.some((identity) => identity.provider === "email") ?? false;

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account name. This doesn&apos;t change the name on your public page.</CardDescription>
        </CardHeader>
        <CardContent>
          <NameForm name={account.display_name} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
          <CardDescription>You&apos;ll need to confirm the change from both addresses.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmailForm email={user.email ?? ""} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            {hasPassword ? "Changing it signs you out on your other devices." : "You sign in with Google, so there's no FindMe password to change."}
          </CardDescription>
        </CardHeader>
        {hasPassword ? (
          <CardContent>
            <PasswordForm />
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
