"use client";

import { useState, useTransition } from "react";
import { Field } from "@/components/forms/field";
import { SelectField } from "@/components/forms/select-field";
import { TextareaField } from "@/components/forms/textarea-field";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/features/media/components/image-upload";
import type { OwnerBlock } from "@/features/profile/queries";
import { type ActionResult, safely } from "@/features/profile/result";
import { createBlockAction, updateBlockAction } from "../actions";
import { BLOCK_DEFINITIONS, type FieldDefinition } from "../definitions";
import { isoToLocalInput, localInputToIso } from "../schedule";
import type { BlockType } from "../schema";

type Props = {
  type: BlockType;
  block?: OwnerBlock;
  onSaved: (block: OwnerBlock) => void;
  onCancel: () => void;
};

function initialValues(type: BlockType, block?: OwnerBlock): Record<string, string> {
  const values: Record<string, string> = { ...BLOCK_DEFINITIONS[type].defaults };
  for (const [key, value] of Object.entries(block?.config ?? {})) {
    if (typeof value === "string") values[key] = value;
  }
  return values;
}

/** Empty optional fields are left out, so they aren't validated or stored as blank strings. */
function toConfig(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim() !== ""));
}

export function BlockForm({ type, block, onSaved, onCancel }: Props) {
  const definition = BLOCK_DEFINITIONS[type];
  const [values, setValues] = useState(() => initialValues(type, block));
  const [startsAt, setStartsAt] = useState(() => isoToLocalInput(block?.starts_at ?? null));
  const [endsAt, setEndsAt] = useState(() => isoToLocalInput(block?.ends_at ?? null));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (name: string, value: string) => setValues((current) => ({ ...current, [name]: value }));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setMessage(null);

    startTransition(async () => {
      const input = {
        type,
        config: toConfig(values),
        schedule: { startsAt: localInputToIso(startsAt), endsAt: localInputToIso(endsAt) },
      };
      const result = await safely<ActionResult<{ block: OwnerBlock }>>(() =>
        block ? updateBlockAction({ id: block.id, ...input }) : createBlockAction(input),
      );

      if (result.ok) {
        onSaved(result.block);
        return;
      }
      setErrors(result.fieldErrors ?? {});
      setMessage(result.message);
    });
  }

  function renderField(field: FieldDefinition) {
    const id = `${block?.id ?? "new"}-${field.name}`;
    const value = values[field.name] ?? "";

    switch (field.kind) {
      case "textarea":
        return (
          <TextareaField
            key={field.name}
            id={id}
            label={field.label}
            value={value}
            placeholder={field.placeholder}
            hint={field.hint}
            error={errors[field.name]}
            onChange={(event) => set(field.name, event.target.value)}
          />
        );
      case "select":
        return (
          <SelectField
            key={field.name}
            id={id}
            label={field.label}
            value={value}
            options={field.options ?? []}
            onChange={(event) => set(field.name, event.target.value)}
          />
        );
      case "image":
        return (
          <div key={field.name}>
            <ImageUpload label={field.label} value={value || null} onChange={(path) => set(field.name, path ?? "")} hint={field.hint} />
            {errors[field.name] ? <p className="mt-1 text-sm text-destructive">{errors[field.name]}</p> : null}
          </div>
        );
      default:
        return (
          <Field
            key={field.name}
            id={id}
            name={field.name}
            label={field.label}
            type={field.kind === "url" ? "text" : field.kind}
            inputMode={field.kind === "url" ? "url" : undefined}
            value={value}
            placeholder={field.placeholder}
            hint={field.hint}
            error={errors[field.name]}
            onChange={(event) => set(field.name, event.target.value)}
            required={field.required}
          />
        );
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      {message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}
      {errors.form ? <p role="alert" className="text-sm text-destructive">{errors.form}</p> : null}
      {definition.fields.map(renderField)}

      <details className="rounded-lg border p-3 text-sm" open={Boolean(startsAt || endsAt)}>
        <summary className="cursor-pointer font-medium">Schedule</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field
            name="startsAt"
            id={`${block?.id ?? "new"}-startsAt`}
            label="Show from"
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            error={errors.startsAt}
          />
          <Field
            name="endsAt"
            id={`${block?.id ?? "new"}-endsAt`}
            label="Hide after"
            type="datetime-local"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            error={errors.endsAt}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Times use your device&apos;s timezone. Changes can take up to a minute to appear.</p>
      </details>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : block ? "Save" : `Add ${definition.label.toLowerCase()}`}</Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>Cancel</Button>
      </div>
    </form>
  );
}
