"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { IDLE_STATE } from "@/features/auth/action-state";
import { submitReportAction } from "../actions";
import { REPORT_REASONS } from "../reasons";

export function ReportForm({ username, links }: { username: string; links: { id: string; title: string }[] }) {
  const [state, action] = useActionState(submitReportAction, IDLE_STATE);
  if (state.status === "success") return <FormMessage status="success" message={state.message} />;

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage status={state.status} message={state.message} />
      <input type="hidden" name="username" value={username} />
      <div className="absolute -left-[10000px] size-px overflow-hidden" aria-hidden>
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <SelectField id="reason" name="reason" label="What's wrong?" options={[{ value: "", label: "Choose a reason" }, ...REPORT_REASONS]} />
      {state.fieldErrors?.reason ? <p className="text-sm text-destructive">{state.fieldErrors.reason}</p> : null}
      {links.length > 0 ? (
        <SelectField id="blockId" name="blockId" label="Is it about one link?" options={[{ value: "", label: "The whole page" }, ...links.map((link) => ({ value: link.id, label: link.title }))]} />
      ) : null}
      <TextareaField id="details" name="details" label="Details" defaultValue={state.values?.details} error={state.fieldErrors?.details} maxLength={2000} />
      <Field name="email" label="Your email (optional)" type="email" defaultValue={state.values?.email} error={state.fieldErrors?.email} hint="Only used if we need to ask you something." />
      <SubmitButton className="justify-self-start">Send report</SubmitButton>
    </form>
  );
}
