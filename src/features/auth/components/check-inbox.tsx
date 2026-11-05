"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { IDLE_STATE } from "../action-state";
import { resendVerificationAction } from "../actions";

export function ResendVerification({ email }: { email: string }) {
  const [state, action] = useActionState(resendVerificationAction, IDLE_STATE);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="email" value={email} />
      <FormMessage status={state.status} message={state.message ?? state.fieldErrors?.email} />
      <SubmitButton variant="outline">Send a new link</SubmitButton>
    </form>
  );
}

export function CheckInbox({ email }: { email: string }) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
        <p className="text-muted-foreground">
          If <span className="font-medium text-foreground">{email}</span> can be registered, we&apos;ve sent a link to
          confirm it. Follow the link to finish setting up your page.
        </p>
      </div>
      <ul className="grid list-disc gap-1 pl-5 text-sm text-muted-foreground">
        <li>It can take a few minutes. Check your spam folder too.</li>
        <li>
          Already have an account with this address? We won&apos;t send a new email, so{" "}
          <Link href="/login" className="font-medium text-foreground underline underline-offset-2">log in</Link> or{" "}
          <Link href="/forgot-password" className="font-medium text-foreground underline underline-offset-2">reset your password</Link> instead.
        </li>
      </ul>
      <ResendVerification email={email} />
    </div>
  );
}
