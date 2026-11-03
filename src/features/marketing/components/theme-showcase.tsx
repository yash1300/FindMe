"use client";

import { useState } from "react";
import { ProfileView } from "@/features/profile/components/profile-view";
import { PRESET_LABELS, THEME_PRESETS } from "@/features/themes/presets";
import { PRESET_IDS, type PresetId } from "@/features/themes/schema";
import { demoProfile } from "../demo";

/** A static sample, so that its links do nothing and it can't look like a real page. */
export function DemoPhone({ preset, label }: { preset: PresetId; label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="flex h-[30rem] w-full max-w-[20rem] flex-col overflow-hidden rounded-[2rem] border-4 border-brand-midnight bg-white shadow-xl"
      inert
    >
      <ProfileView data={demoProfile(THEME_PRESETS[preset])} preview />
    </div>
  );
}

export function ThemeShowcase() {
  const [preset, setPreset] = useState<PresetId>("gradient");
  return (
    <div className="grid justify-items-center gap-4">
      <DemoPhone key={preset} preset={preset} label={`Example page using the ${PRESET_LABELS[preset]} theme`} />
      <div role="group" aria-label="Try a theme" className="flex max-w-md flex-wrap justify-center gap-1.5">
        {PRESET_IDS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={preset === id}
            onClick={() => setPreset(id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${
              preset === id ? "border-brand-midnight bg-brand-midnight text-white" : "bg-background hover:bg-muted"
            }`}
          >
            {PRESET_LABELS[id]}
          </button>
        ))}
      </div>
    </div>
  );
}
