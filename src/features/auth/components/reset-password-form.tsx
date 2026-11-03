"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { IDLE_STATE } from "../action-state";
import { resetPasswordAction } from "../actions";
import { PASSWORD_MIN_LENGTH } from "../schema";

export function ResetPasswordForm() {
  const [state, action] = useActionState(resetPasswordAction, IDLE_STATE);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage status={state.status} message={state.message} />
      <Field
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        error={state.fieldErrors?.password}
        hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        required
      />
      <Field
        name="confirmPassword"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        error={state.fieldErrors?.confirmPassword}
        required
      />
      <SubmitButton className="w-full">Set new password</SubmitButton>
    </form>
  );
}
