import type { z } from "zod";

export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Non-secret inputs echoed back, because React resets forms after an action completes. */
  values?: Record<string, string>;
  /** Machine-readable outcome for forms that switch to a different view. */
  code?: "check_email" | "email_not_confirmed";
  email?: string;
};

export const IDLE_STATE: ActionState = { status: "idle" };

export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}

export function validationError(error: z.ZodError, values?: Record<string, string>): ActionState {
  return { status: "error", fieldErrors: fieldErrorsFrom(error), values };
}

export function formError(message: string, values?: Record<string, string>): ActionState {
  return { status: "error", message, values };
}

export const UNAVAILABLE_MESSAGE = "We can't process that right now. Please try again in a moment.";

export function tooManyAttempts(retryAfterSeconds: number, values?: Record<string, string>): ActionState {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return formError(
    `Too many attempts. Please try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`,
    values,
  );
}

/** Reads form fields as strings. A file or missing value becomes undefined, which Zod then rejects. */
export function formValues(formData: FormData, names: readonly string[]): Record<string, string | undefined> {
  return Object.fromEntries(
    names.map((name) => {
      const value = formData.get(name);
      return [name, typeof value === "string" ? value : undefined];
    }),
  );
}
