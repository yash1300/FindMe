"use client";

import { Check, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Field } from "@/components/forms/field";
import { USERNAME_MAX_LENGTH, usernameSchema } from "../schema";

type Availability =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "unavailable"; message: string }
  /** The check itself failed. The server re-validates on submit, so this never blocks the form. */
  | { state: "unknown" };

const DEBOUNCE_MS = 350;

export function UsernameField({
  defaultValue = "",
  error,
  baseUrl,
  skipCheckFor,
}: {
  defaultValue?: string;
  error?: string;
  baseUrl: string;
  /** The user's current name, which would otherwise be reported as taken. */
  skipCheckFor?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [availability, setAvailability] = useState<Availability>({ state: "idle" });
  // The server's error is about what was submitted, so it's hidden once the user edits the field.
  const [dismissedError, setDismissedError] = useState<string | undefined>();
  if (!error && dismissedError) setDismissedError(undefined);

  const parsed = usernameSchema.safeParse(value);
  const normalized = parsed.success ? parsed.data : null;

  useEffect(() => {
    if (!normalized || normalized === skipCheckFor) return;
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setAvailability({ state: "checking" });
      try {
        const response = await fetch(`/api/usernames/check?username=${encodeURIComponent(normalized)}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          setAvailability({ state: "unknown" });
          return;
        }
        const body: { available: boolean; message?: string } = await response.json();
        setAvailability(
          body.available
            ? { state: "available" }
            : { state: "unavailable", message: body.message ?? "This username isn't available." },
        );
      } catch (caught) {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) {
          setAvailability({ state: "unknown" });
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [normalized, skipCheckFor]);

  const liveError =
    value && !parsed.success
      ? parsed.error.issues[0].message
      : normalized && availability.state === "unavailable"
        ? availability.message
        : undefined;

  const host = baseUrl.replace(/^https?:\/\//, "");

  return (
    <Field
      name="username"
      label="Username"
      value={value}
      onChange={(event) => {
        setValue(event.target.value);
        setAvailability({ state: "idle" });
        setDismissedError(error);
      }}
      error={liveError ?? (error !== dismissedError ? error : undefined)}
      autoComplete="username"
      autoCapitalize="none"
      spellCheck={false}
      maxLength={USERNAME_MAX_LENGTH}
      required
      hint={
        <span className="flex items-center gap-1.5" aria-live="polite">
          <span className="truncate">
            {host}/{normalized ?? "username"}
          </span>
          {normalized && availability.state === "checking" ? (
            <Loader2 className="size-3 animate-spin" aria-label="Checking availability" />
          ) : null}
          {normalized && availability.state === "available" ? (
            <span className="inline-flex items-center gap-0.5 font-medium text-emerald-700 dark:text-emerald-300">
              <Check className="size-3" aria-hidden /> Available
            </span>
          ) : null}
          {normalized && availability.state === "unavailable" ? (
            <X className="size-3 text-destructive" aria-hidden />
          ) : null}
        </span>
      }
    />
  );
}
