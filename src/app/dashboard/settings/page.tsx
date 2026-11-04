import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { DeleteAccountForm, EmailForm, NameForm, PasswordForm } from "@/features/accounts/components/settings-forms";
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

      <Card>
        <CardHeader>
          <CardTitle>Your data</CardTitle>
          <CardDescription>Download a copy of everything FindMe holds for you, including your pages, signups and analytics totals.</CardDescription>
        </CardHeader>
        <CardContent>
          <a href="/api/account/export" download className={buttonVariants({ variant: "outline" })}>Download my data</a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
          <CardDescription>This permanently removes your account, all your pages, your images, and the signups and messages you&apos;ve collected. It can&apos;t be undone.</CardDescription>
        </CardHeader>
        <CardContent>
          <details>
            <summary className="cursor-pointer text-sm text-muted-foreground">I want to delete my account</summary>
            <div className="mt-4"><DeleteAccountForm hasPassword={hasPassword} /></div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
