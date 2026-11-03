"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { IDLE_STATE } from "@/features/auth/action-state";
import { submitContactAction } from "@/features/leads/actions";

export function MarketingContactForm() {
  const [state, action] = useActionState(submitContactAction, IDLE_STATE);

  if (state.status === "success") return <FormMessage status="success" message={state.message} />;

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage status={state.status} message={state.message} />
      <div className="absolute -left-[10000px] size-px overflow-hidden" aria-hidden>
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Field name="name" label="Name" autoComplete="name" defaultValue={state.values?.name} error={state.fieldErrors?.name} required />
      <Field name="email" label="Email" type="email" autoComplete="email" defaultValue={state.values?.email} error={state.fieldErrors?.email} required />
      <TextareaField id="message" name="message" label="Message" rows={5} defaultValue={state.values?.message} error={state.fieldErrors?.message} required />
      <SubmitButton className="justify-self-start">Send message</SubmitButton>
    </form>
  );
}
