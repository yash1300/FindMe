"use client";

import { AlertTriangle, Check, Loader2, Redo2, RotateCcw, Save, Undo2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { saveThemeAction } from "@/features/profile/actions";
import { PreviewFrame } from "@/features/profile/components/preview-frame";
import type { ProfileViewData } from "@/features/profile/components/profile-view";
import { applyEdit, createHistory, redo, undo } from "../history";
import { THEME_PRESETS } from "../presets";
import type { PresetId, Theme } from "../schema";
import { ThemeControls, type ThemePatch } from "./theme-controls";

const AUTOSAVE_DELAY_MS = 1200;

type SaveState = "saved" | "unsaved" | "saving" | "error" | "conflict";

type Props = {
  initialTheme: Theme;
  initialVersion: number;
  viewData: Omit<ProfileViewData, "theme">;
};

function SaveStatus({ state, message }: { state: SaveState; message: string | null }) {
  const content = {
    saved: { icon: <Check className="size-4 text-emerald-700 dark:text-emerald-300" aria-hidden />, text: "All changes saved" },
    unsaved: { icon: null, text: "Unsaved changes" },
    saving: { icon: <Loader2 className="size-4 animate-spin" aria-hidden />, text: "Saving…" },
    error: { icon: <AlertTriangle className="size-4 text-destructive" aria-hidden />, text: message ?? "Couldn't save" },
    conflict: { icon: <AlertTriangle className="size-4 text-destructive" aria-hidden />, text: "Changed elsewhere" },
  }[state];

  return (
    <span role="status" data-testid="save-status" data-state={state} className="flex items-center gap-1.5 text-sm text-muted-foreground">
      {content.icon}
      {content.text}
    </span>
  );
}

export function AppearanceEditor({ initialTheme, initialVersion, viewData }: Props) {
  const [history, setHistory] = useState(() => createHistory(initialTheme));
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [message, setMessage] = useState<string | null>(null);

  const theme = history.present;
  const versionRef = useRef(initialVersion);
  const lastSavedRef = useRef(initialTheme);
  const savingRef = useRef(false);
  const latestRef = useRef(theme);
  const conflictRef = useRef(false);

  // Saves are sent one at a time, each carrying the version from the last, so they can't race.
  const save = useCallback(async () => {
    if (savingRef.current || conflictRef.current) return;

    savingRef.current = true;
    setMessage(null);

    // Repeats if the user kept editing while a save was in flight.
    while (latestRef.current !== lastSavedRef.current) {
      const target = latestRef.current;
      setSaveState("saving");

      const result = await saveThemeAction({ theme: target, expectedVersion: versionRef.current }).catch(() => ({
        ok: false as const,
        code: undefined,
        message: "We couldn't reach the server. Your changes are safe here, so try again.",
      }));

      if (!result.ok) {
        if (result.code === "conflict") conflictRef.current = true;
        setSaveState(result.code === "conflict" ? "conflict" : "error");
        setMessage(result.message);
        savingRef.current = false;
        return;
      }

      versionRef.current = result.version;
      lastSavedRef.current = target;
    }

    savingRef.current = false;
    setSaveState("saved");
  }, []);

  useEffect(() => {
    latestRef.current = theme;
    if (theme === lastSavedRef.current || conflictRef.current) return;

    setSaveState("unsaved");
    const timer = setTimeout(() => void save(), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [theme, save]);

  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (latestRef.current !== lastSavedRef.current) event.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const handleUndo = useCallback(() => setHistory(undo), []);
  const handleRedo = useCallback(() => setHistory(redo), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      const target = event.target as HTMLElement;
      if (target.matches("input[type=text], textarea")) return;
      event.preventDefault();
      if (event.shiftKey) handleRedo();
      else handleUndo();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleUndo, handleRedo]);

  const patch: ThemePatch = (section, values, groupKey) => {
    setHistory((current) =>
      applyEdit(
        current,
        { ...current.present, [section]: { ...(current.present[section] as object), ...values } } as Theme,
        groupKey ?? null,
      ),
    );
  };

  function choosePreset(preset: PresetId) {
    setHistory((current) => applyEdit(current, THEME_PRESETS[preset]));
  }

  const hasConflict = saveState === "conflict";

  return (
    <div className="grid gap-4">
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2">
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Undo" disabled={history.past.length === 0} onClick={handleUndo}>
          <Undo2 aria-hidden />
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Redo" disabled={history.future.length === 0} onClick={handleRedo}>
          <Redo2 aria-hidden />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => choosePreset(theme.preset)}
          disabled={theme === THEME_PRESETS[theme.preset]}
        >
          <RotateCcw aria-hidden /> Reset
        </Button>
        <span className="ml-auto" />
        <SaveStatus state={saveState} message={message} />
        <Button type="button" size="sm" onClick={() => void save()} disabled={saveState === "saved" || saveState === "saving" || hasConflict}>
          <Save aria-hidden /> Save
        </Button>
      </div>

      {hasConflict ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p>{message} Your unsaved edits are still shown here, but won&apos;t be saved over the newer version.</p>
          <Button type="button" size="sm" variant="outline" onClick={() => window.location.reload()}>Reload latest</Button>
        </div>
      ) : null}
      {saveState === "error" && message ? <p role="alert" className="text-sm text-destructive">{message}</p> : null}

      <div className="grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <ThemeControls theme={theme} patch={patch} onPreset={choosePreset} />
        <div className="lg:sticky lg:top-16">
          <PreviewFrame data={{ ...viewData, theme }} />
        </div>
      </div>
    </div>
  );
}
