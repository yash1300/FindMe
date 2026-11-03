"use client";

import { useActionState } from "react";
import { IDLE_STATE } from "@/features/auth/action-state";
import { submitLeadAction } from "@/features/leads/actions";
import { leadConsentText } from "@/features/leads/schema";

type FormProps = {
  blockId: string;
  ownerName: string;
  buttonLabel: string;
  /** In the editor preview, forms are shown but can't submit. */
  preview: boolean;
};

function Honeypot() {
  return (
    <div className="fm-honeypot" aria-hidden>
      <label>
        Website
        <input type="text" name="website" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}

function Consent({ id, text, error }: { id: string; text: string; error?: string }) {
  return (
    <>
      <label htmlFor={id} className="fm-consent">
        <input id={id} type="checkbox" name="consent" disabled={false} />
        <span>{text}</span>
      </label>
      {error ? <p className="fm-form-message">{error}</p> : null}
    </>
  );
}

function SubmitRow({ label, preview, pending }: { label: string; preview: boolean; pending: boolean }) {
  return (
    <button type="submit" className="fm-button" data-style="filled" disabled={preview || pending}>
      <span className="fm-button-body">{pending ? "Sending…" : label}</span>
    </button>
  );
}

export function NewsletterForm({ blockId, ownerName, buttonLabel, preview }: FormProps) {
  const [state, action, pending] = useActionState(submitLeadAction, IDLE_STATE);
  if (state.status === "success") return <p className="fm-form-message" role="status">{state.message}</p>;

  return (
    <form action={action} className="fm-form" noValidate>
      <input type="hidden" name="blockId" value={blockId} />
      <Honeypot />
      <div>
        <label htmlFor={`${blockId}-email`} className="fm-field-label">Email</label>
        <input id={`${blockId}-email`} className="fm-field" type="email" name="email" autoComplete="email" defaultValue={state.values?.email} required />
        {state.fieldErrors?.email ? <p className="fm-form-message">{state.fieldErrors.email}</p> : null}
      </div>
      <Consent id={`${blockId}-consent`} text={leadConsentText("newsletter", ownerName)} error={state.fieldErrors?.consent} />
      {state.message ? <p className="fm-form-message" role="alert">{state.message}</p> : null}
      <SubmitRow label={buttonLabel} preview={preview} pending={pending} />
    </form>
  );
}

export function ContactForm({ blockId, ownerName, buttonLabel, preview }: FormProps) {
  const [state, action, pending] = useActionState(submitLeadAction, IDLE_STATE);
  if (state.status === "success") return <p className="fm-form-message" role="status">{state.message}</p>;

  return (
    <form action={action} className="fm-form" noValidate>
      <input type="hidden" name="blockId" value={blockId} />
      <Honeypot />
      <div>
        <label htmlFor={`${blockId}-name`} className="fm-field-label">Name</label>
        <input id={`${blockId}-name`} className="fm-field" name="name" autoComplete="name" defaultValue={state.values?.name} />
      </div>
      <div>
        <label htmlFor={`${blockId}-email`} className="fm-field-label">Email</label>
        <input id={`${blockId}-email`} className="fm-field" type="email" name="email" autoComplete="email" defaultValue={state.values?.email} required />
        {state.fieldErrors?.email ? <p className="fm-form-message">{state.fieldErrors.email}</p> : null}
      </div>
      <div>
        <label htmlFor={`${blockId}-message`} className="fm-field-label">Message</label>
        <textarea id={`${blockId}-message`} className="fm-field" name="message" rows={4} defaultValue={state.values?.message} required />
        {state.fieldErrors?.message ? <p className="fm-form-message">{state.fieldErrors.message}</p> : null}
      </div>
      <Consent id={`${blockId}-consent`} text={leadConsentText("contact", ownerName)} error={state.fieldErrors?.consent} />
      {state.message ? <p className="fm-form-message" role="alert">{state.message}</p> : null}
      <SubmitRow label={buttonLabel} preview={preview} pending={pending} />
    </form>
  );
}
