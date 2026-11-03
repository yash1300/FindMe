import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { FormSkeleton } from "@/components/forms/form-skeleton";
import { Button } from "@/components/ui/button";
import { OnboardingForm } from "@/features/accounts/components/onboarding-form";
import { signOutAction } from "@/features/auth/actions";
import { getAccountContext, requireUser } from "@/features/auth/session";
import { hasCurrentConsent } from "@/features/legal/versions";
import { OnboardingWizard } from "@/features/onboarding/components/wizard";
import { getOwnerContent } from "@/features/profile/queries";
import { parseTheme } from "@/features/themes/presets";
import { getAppUrl } from "@/lib/env";

export const metadata: Metadata = { title: "Set up your page", robots: { index: false, follow: false } };

async function OnboardingContent() {
  const user = await requireUser("/onboarding");
  const { account, profile } = await getAccountContext(user.id);

  if (account.status === "suspended") redirect("/suspended");

  const needsConsent = !hasCurrentConsent(account);

  // People without a username or current consent, such as new Google users, start here.
  if (!profile || needsConsent) {
    return (
      <>
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {profile ? "We've updated our terms" : "Claim your link"}
          </h1>
          <p className="text-muted-foreground">
            {profile
              ? "Please review and accept them to keep using FindMe."
              : "Choose the username people will use to find you."}
          </p>
        </div>
        <OnboardingForm
          baseUrl={getAppUrl()}
          defaultName={account.display_name}
          needsProfile={!profile}
          needsConsent={needsConsent}
        />
      </>
    );
  }

  if (profile.onboarding_completed_at) redirect("/dashboard");

  const { blocks, socialLinks } = await getOwnerContent(profile.id);
  return (
    <OnboardingWizard
      baseUrl={getAppUrl()}
      profile={profile}
      theme={parseTheme(profile.theme)}
      blocks={blocks}
      socialLinks={socialLinks}
    />
  );
}

export default function OnboardingPage() {
  return (
    <div className="flex flex-1 flex-col p-6 sm:p-10">
      <header className="flex items-center justify-between">
        <Logo />
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="sm">
            Log out
          </Button>
        </form>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 py-10">
        <Suspense fallback={<FormSkeleton />}>
          <OnboardingContent />
        </Suspense>
      </main>
    </div>
  );
}
