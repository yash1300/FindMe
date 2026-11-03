"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { IDLE_STATE } from "@/features/auth/action-state";
import { PASSWORD_MIN_LENGTH } from "@/features/auth/schema";
import { changeEmailAction, changePasswordAction, updateAccountNameAction } from "../actions";

export function NameForm({ name }: { name: string }) {
  const [state, action] = useActionState(updateAccountNameAction, IDLE_STATE);
  return (
    <form action={action} className="grid gap-4">
      <FormMessage status={state.status} message={state.message} />
      <Field
        name="name"
        label="Name"
        autoComplete="name"
        defaultValue={state.values?.name ?? name}
        error={state.fieldErrors?.name}
        required
      />
      <SubmitButton className="justify-self-start">Save name</SubmitButton>
    </form>
  );
}

export function EmailForm({ email }: { email: string }) {
  const [state, action] = useActionState(changeEmailAction, IDLE_STATE);
  return (
    <form action={action} className="grid gap-4">
      <FormMessage status={state.status} message={state.message} />
      <p className="text-sm text-muted-foreground">
        Current address: <span className="font-medium text-foreground">{email}</span>
      </p>
      <Field name="email" label="New email" type="email" autoComplete="email" error={state.fieldErrors?.email} required />
      <SubmitButton className="justify-self-start">Change email</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, IDLE_STATE);
  return (
    <form action={action} className="grid gap-4">
      <FormMessage status={state.status} message={state.message} />
      <Field
        name="currentPassword"
        label="Current password"
        type="password"
        autoComplete="current-password"
        error={state.fieldErrors?.currentPassword}
        required
      />
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
      <SubmitButton className="justify-self-start">Change password</SubmitButton>
    </form>
  );
}
