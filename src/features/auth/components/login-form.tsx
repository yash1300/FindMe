"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { IDLE_STATE } from "../action-state";
import { loginAction } from "../actions";
import { ResendVerification } from "./check-inbox";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(loginAction, IDLE_STATE);

  return (
    <div className="grid gap-4">
      <form action={action} className="grid gap-4" noValidate>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <FormMessage status={state.status} message={state.message} />
        <Field
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          defaultValue={state.values?.email}
          error={state.fieldErrors?.email}
          required
        />
        <Field
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          error={state.fieldErrors?.password}
          required
        />
        <div className="text-right text-sm">
          <Link href="/forgot-password" className="text-muted-foreground underline underline-offset-2 hover:text-foreground">
            Forgot your password?
          </Link>
        </div>
        <SubmitButton className="w-full">Log in</SubmitButton>
      </form>
      {state.code === "email_not_confirmed" && state.email ? <ResendVerification email={state.email} /> : null}
    </div>
  );
}
