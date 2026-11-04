"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { IDLE_STATE } from "@/features/auth/action-state";
import { UsernameField } from "@/features/usernames/components/username-field";
import { createPageAction, deletePageAction } from "../manage-actions";

export function CreatePageForm({ baseUrl }: { baseUrl: string }) {
  const [state, action] = useActionState(createPageAction, IDLE_STATE);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage status={state.status} message={state.message} />
      <UsernameField key={state.values?.username ?? ""} baseUrl={baseUrl} defaultValue={state.values?.username} error={state.fieldErrors?.username} />
      <Field name="name" label="Display name" defaultValue={state.values?.name} error={state.fieldErrors?.name} required />
      <SubmitButton className="justify-self-start">Create page</SubmitButton>
    </form>
  );
}

export function DeletePageForm({ id, username }: { id: string; username: string }) {
  const [state, action] = useActionState(deletePageAction, IDLE_STATE);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start" noValidate>
      <input type="hidden" name="id" value={id} />
      <div className="sm:col-span-2"><FormMessage status={state.status} message={state.message} /></div>
      <Field id={`confirm-${id}`} name="confirm" label={`Type ${username} to delete this page and everything on it`} autoComplete="off" error={state.fieldErrors?.confirm} />
      <SubmitButton variant="destructive" className="sm:mt-[1.375rem]">Delete page</SubmitButton>
    </form>
  );
}
