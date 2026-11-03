"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { IDLE_STATE } from "../action-state";
import { requestPasswordResetAction } from "../actions";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordResetAction, IDLE_STATE);
  return (
    <form action={action} className="grid gap-4" noValidate>
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
      <SubmitButton className="w-full">Send reset link</SubmitButton>
    </form>
  );
}
