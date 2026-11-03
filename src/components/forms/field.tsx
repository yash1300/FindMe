import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FieldProps = ComponentProps<"input"> & {
  name: string;
  label: string;
  error?: string;
  hint?: ReactNode;
};

/** A labelled input whose error and hint are announced to screen readers. */
export function Field({ name, label, error, hint, id = name, ...inputProps }: FieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...inputProps} />
      {hint ? (
        <div id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </div>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
