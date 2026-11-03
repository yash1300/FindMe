import { SubmitButton } from "@/components/forms/submit-button";
import { isGoogleAuthEnabled } from "@/lib/env";
import { signInWithGoogleAction } from "../actions";

/** Renders nothing until Google has been configured, so that the button is never dead. */
export function GoogleSignIn({ next }: { next?: string }) {
  if (!isGoogleAuthEnabled()) return null;
  return (
    <div className="grid gap-4">
      <form action={signInWithGoogleAction}>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <SubmitButton variant="outline" className="w-full">
          Continue with Google
        </SubmitButton>
      </form>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
