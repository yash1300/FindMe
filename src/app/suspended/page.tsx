import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { FormSkeleton } from "@/components/forms/form-skeleton";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/actions";
import { getAccountContext, requireUser } from "@/features/auth/session";
import { getSupportEmail } from "@/lib/env";

export const metadata: Metadata = { title: "Account suspended", robots: { index: false, follow: false } };

async function SuspendedContent() {
  const user = await requireUser("/suspended");
  const { account } = await getAccountContext(user.id);
  if (account.status !== "suspended") redirect("/dashboard");

  const supportEmail = getSupportEmail();

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Your account is suspended</h1>
      <p className="text-muted-foreground">
        Your account and public page are unavailable.
        {supportEmail ? (
          <>
            {" "}
            To ask about this, email{" "}
            <a href={`mailto:${supportEmail}`} className="font-medium text-foreground underline underline-offset-2">
              {supportEmail}
            </a>
            .
          </>
        ) : null}
      </p>
      <form action={signOutAction}>
        <Button type="submit" variant="outline">
          Log out
        </Button>
      </form>
    </>
  );
}

export default function SuspendedPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 p-8">
      <Logo />
      <Suspense fallback={<FormSkeleton rows={1} />}>
        <SuspendedContent />
      </Suspense>
    </main>
  );
}
