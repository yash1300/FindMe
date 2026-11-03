"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { UsernameField } from "@/features/usernames/components/username-field";
import { IDLE_STATE } from "../action-state";
import { registerAction } from "../actions";
import { PASSWORD_MIN_LENGTH } from "../schema";
import { CheckInbox } from "./check-inbox";
import { ConsentField } from "./consent-field";

export function RegisterForm({ baseUrl }: { baseUrl: string }) {
  const [state, action] = useActionState(registerAction, IDLE_STATE);

  if (state.code === "check_email" && state.email) return <CheckInbox email={state.email} />;

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage status={state.status} message={state.message} />
      <Field
        name="name"
        label="Name"
        autoComplete="name"
        defaultValue={state.values?.name}
        error={state.fieldErrors?.name}
        required
      />
      <Field
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
        required
      />
      {/* Remounted when the server responds, so it picks up the echoed value and its error. */}
      <UsernameField
        key={state.values?.username ?? ""}
        baseUrl={baseUrl}
        defaultValue={state.values?.username}
        error={state.fieldErrors?.username}
      />
      <Field
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        error={state.fieldErrors?.password}
        hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        required
      />
      <ConsentField error={state.fieldErrors?.consent} />
      <SubmitButton className="w-full">Create your free page</SubmitButton>
    </form>
  );
}
