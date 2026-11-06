import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { FormSkeleton } from "@/components/forms/form-skeleton";
import { GoogleSignIn } from "@/features/auth/components/google-button";
import { LoginForm } from "@/features/auth/components/login-form";
import { safeRedirectPath } from "@/lib/security/safe-redirect";

export const metadata: Metadata = { title: "Log in" };

const ERROR_MESSAGES: Record<string, string> = {
  auth_callback: "That link is invalid, expired or already used. If you've already confirmed your email, just log in below.",
  oauth_cancelled: "Google sign-in didn't finish. Please try again, or log in with your email.",
  oauth: "We couldn't start Google sign-in. Please try again or use your email.",
};

type SearchParams = Promise<{ next?: string | string[]; error?: string | string[] }>;

async function LoginContent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = safeRedirectPath(params.next);
  const error = typeof params.error === "string" ? ERROR_MESSAGES[params.error] : undefined;

  return (
    <>
      <FormMessage status="error" message={error} />
      <GoogleSignIn next={next} />
      <LoginForm next={next} />
    </>
  );
}

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground">Log in to manage your page.</p>
      </div>
      <Suspense fallback={<FormSkeleton />}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
      <p className="text-center text-sm text-muted-foreground">
        New to FindMe?{" "}
        <Link href="/register" className="font-medium text-foreground underline underline-offset-2">
          Create your free page
        </Link>
      </p>
    </div>
  );
}
