import type { Metadata } from "next";
import Link from "next/link";
import { GoogleSignIn } from "@/features/auth/components/google-button";
import { RegisterForm } from "@/features/auth/components/register-form";
import { getAppUrl } from "@/lib/env";

export const metadata: Metadata = { title: "Create your page" };

export default function RegisterPage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Create your FindMe page</h1>
        <p className="text-muted-foreground">It&apos;s completely free, and only takes a few minutes.</p>
      </div>
      <GoogleSignIn next="/onboarding" />
      <RegisterForm baseUrl={getAppUrl()} />
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-2">
          Log in
        </Link>
      </p>
    </div>
  );
}
