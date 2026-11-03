import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { FormSkeleton } from "@/components/forms/form-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { RECOVERY_COOKIE } from "@/features/auth/constants";
import { getCurrentUser } from "@/features/auth/session";

export const metadata: Metadata = { title: "Choose a new password" };

async function ResetPasswordContent() {
  const [user, cookieStore] = await Promise.all([getCurrentUser(), cookies()]);
  const isValid = Boolean(user) && cookieStore.get(RECOVERY_COOKIE)?.value === user?.id;

  if (!isValid) {
    return (
      <div className="grid gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">This link has expired</h1>
        <p className="text-muted-foreground">Reset links work once and only for a short time. Please request a new one.</p>
        <Link href="/forgot-password" className={buttonVariants()}>
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="text-muted-foreground">This will sign you out on your other devices.</p>
      </div>
      <ResetPasswordForm />
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
