import Link from "next/link";

export function ConsentField({ error }: { error?: string }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor="consent" className="flex items-start gap-2 text-sm">
        <input
          id="consent"
          name="consent"
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "consent-error" : undefined}
          className="mt-0.5 size-4 accent-brand-violet"
        />
        <span className="text-muted-foreground">
          I agree to the{" "}
          <Link href="/terms" target="_blank" className="font-medium text-foreground underline underline-offset-2">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" target="_blank" className="font-medium text-foreground underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      {error ? (
        <p id="consent-error" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
