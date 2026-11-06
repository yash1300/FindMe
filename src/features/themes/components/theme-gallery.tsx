"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { safely } from "@/features/profile/result";
import { readableOn } from "../css";
import { applyGalleryThemeAction, removeSharedThemeAction, shareThemeAction } from "../gallery-actions";
import type { GalleryTheme, MySharedTheme } from "../gallery";
import type { Theme } from "../schema";

/** A small sample of a theme: its background, text and a button. Colours are validated hex values. */
function Swatch({ theme }: { theme: Theme }) {
  const { background, colors, buttons } = theme;
  const backgroundCss =
    background.type === "gradient"
      ? `linear-gradient(${background.gradientAngle}deg, ${background.gradientFrom}, ${background.gradientTo})`
      : background.color;
  const radius = buttons.shape === "pill" ? "999px" : buttons.shape === "rounded" ? "0.5rem" : "0";
  const outline = buttons.style === "outline";
  return (
    <div aria-hidden className="grid h-28 content-center justify-items-center gap-2 rounded-lg border p-3" style={{ background: backgroundCss }}>
      <span className="size-7 rounded-full" style={{ background: colors.accent }} />
      <span
        className="w-4/5 truncate px-2 py-1 text-center text-xs font-medium"
        style={{
          borderRadius: radius,
          background: outline ? "transparent" : colors.buttonBackground,
          color: outline ? colors.text : readableOn(colors.buttonText, colors.buttonBackground),
          border: outline ? `${Math.max(buttons.borderWidth, 1)}px solid ${colors.buttonBackground}` : undefined,
        }}
      >
        My link
      </span>
    </div>
  );
}

export function ThemeGallery({ themes, mine }: { themes: GalleryTheme[]; mine: MySharedTheme[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const mineIds = new Set(mine.map((item) => item.id));

  function run(action: () => Promise<{ ok: boolean; message?: string }>, done: string, after?: () => void) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await safely(action);
      if (!result.ok) {
        setError(result.message ?? "Something went wrong.");
        return;
      }
      after?.();
      setNotice(done);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6">
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p role="status" className="rounded-lg border bg-muted p-3 text-sm">{notice}</p> : null}

      <form
        noValidate
        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
        onSubmit={(event) => {
          event.preventDefault();
          run(() => shareThemeAction({ name }), "Shared. Other creators can now find your theme in the gallery.", () => setName(""));
        }}
      >
        <Field
          id="share-theme-name"
          name="name"
          label="Share your saved theme"
          placeholder="Give it a name, like Sunset Studio"
          value={name}
          onChange={(event) => setName(event.target.value)}
          hint="Only the look is shared: not your name, page or photos. A background photo becomes its plain colour."
        />
        <Button type="submit" variant="outline" disabled={pending || name.trim().length < 2} className="sm:mt-[1.375rem]">Share</Button>
      </form>

      {mine.length > 0 ? (
        <div className="grid gap-2">
          <h3 className="text-sm font-medium">Themes you&apos;ve shared</h3>
          <ul className="grid gap-2">
            {mine.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.status === "removed" ? "Removed from the gallery by FindMe" : `Used ${item.useCount.toLocaleString("en-IN")} ${item.useCount === 1 ? "time" : "times"}`}
                  </span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  aria-label={`Stop sharing ${item.name}`}
                  onClick={() => run(() => removeSharedThemeAction(item.id), `"${item.name}" is no longer shared.`)}
                >
                  Stop sharing
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-3">
        <h3 className="text-sm font-medium">From other creators</h3>
        {themes.filter((item) => !mineIds.has(item.id)).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody has shared a theme yet. Be the first.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {themes
              .filter((item) => !mineIds.has(item.id))
              .map((item) => (
                <li key={item.id} className="grid gap-2 rounded-xl border bg-card p-3" data-testid="gallery-theme">
                  <Swatch theme={item.theme} />
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{item.name}</span>
                      <span className="text-xs text-muted-foreground">
                        Used {item.useCount.toLocaleString("en-IN")} {item.useCount === 1 ? "time" : "times"}
                      </span>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      aria-label={`Use ${item.name}`}
                      onClick={() => {
                        if (!window.confirm(`Replace your page's theme with "${item.name}"? Your current theme isn't kept.`)) return;
                        // A full load, so the editor starts again from the new theme rather than its own history.
                        run(() => applyGalleryThemeAction(item.id), "", () => window.location.assign("/dashboard/appearance?applied=1"));
                      }}
                    >
                      Use
                    </Button>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}
