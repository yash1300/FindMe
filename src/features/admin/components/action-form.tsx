"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { type ActionState, IDLE_STATE } from "@/features/auth/action-state";

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  hidden: Record<string, string | undefined>;
  label: string;
  destructive?: boolean;
};

/**
 * Every moderation action asks for a reason, which goes into the permanent log. Keyed by label, so
 * when "Suspend" becomes "Restore" it's a fresh, closed form rather than the old one with its message.
 */
export function ReasonActionForm(props: Props) {
  return <ActionForm key={props.label} {...props} />;
}

function ActionForm({ action, hidden, label, destructive = false }: Props) {
  const [state, formAction] = useActionState(action, IDLE_STATE);
  const idSuffix = Object.values(hidden).join("-") + label.replace(/\s/g, "");
  return (
    <details className="rounded-lg border p-3 text-sm">
      <summary className="cursor-pointer font-medium">{label}</summary>
      <form action={formAction} className="mt-3 grid gap-3" noValidate>
        <FormMessage status={state.status} message={state.message} />
        {Object.entries(hidden).map(([name, value]) => (value ? <input key={name} type="hidden" name={name} value={value} /> : null))}
        <Field id={`reason-${idSuffix}`} name="reason" label="Reason" error={state.fieldErrors?.reason} autoComplete="off" required />
        <SubmitButton size="sm" variant={destructive ? "destructive" : "default"} className="justify-self-start">Confirm: {label}</SubmitButton>
      </form>
    </details>
  );
}
