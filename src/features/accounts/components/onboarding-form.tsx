"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { IDLE_STATE } from "@/features/auth/action-state";
import { ConsentField } from "@/features/auth/components/consent-field";
import { UsernameField } from "@/features/usernames/components/username-field";
import { completeOnboardingAction } from "../actions";

type Props = {
  baseUrl: string;
  defaultName: string;
  needsProfile: boolean;
  needsConsent: boolean;
};

export function OnboardingForm({ baseUrl, defaultName, needsProfile, needsConsent }: Props) {
  const [state, action] = useActionState(completeOnboardingAction, IDLE_STATE);

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage status={state.status} message={state.message} />
      {needsProfile ? (
        <>
          <UsernameField
            key={state.values?.username ?? ""}
            baseUrl={baseUrl}
            defaultValue={state.values?.username}
            error={state.fieldErrors?.username}
          />
          <Field
            name="name"
            label="Display name"
            autoComplete="name"
            defaultValue={state.values?.name ?? defaultName}
            error={state.fieldErrors?.name}
            required
          />
        </>
      ) : null}
      {needsConsent ? <ConsentField error={state.fieldErrors?.consent} /> : null}
      <SubmitButton className="w-full">Continue</SubmitButton>
    </form>
  );
}
