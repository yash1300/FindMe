"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { IDLE_STATE } from "@/features/auth/action-state";
import { updateSettingsAction } from "../actions";

export function SettingsForm({ maxProfiles, announcement }: { maxProfiles: number; announcement: string }) {
  const [state, action] = useActionState(updateSettingsAction, IDLE_STATE);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage status={state.status} message={state.message} />
      <Field name="maxProfiles" label="Pages per account" type="number" min={1} max={50} defaultValue={maxProfiles} error={state.fieldErrors?.maxProfiles} />
      <Field name="announcement" label="Announcement shown across the dashboard" defaultValue={announcement} maxLength={200} error={state.fieldErrors?.announcement} hint="Plain text. Leave empty to show nothing." />
      <SubmitButton className="justify-self-start">Save settings</SubmitButton>
    </form>
  );
}
