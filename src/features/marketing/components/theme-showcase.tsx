"use client";

import { useState } from "react";
import { ProfileView } from "@/features/profile/components/profile-view";
import { PRESET_LABELS, THEME_PRESETS } from "@/features/themes/presets";
import { PRESET_IDS, type PresetId } from "@/features/themes/schema";
import { demoProfile } from "../demo";

/**
 * A sample page in a phone frame. The screen scrolls, so nothing is cut off, while the content inside
 * is inert, so its links do nothing. The scrollbar stays hidden to keep the page centred in the frame.
 */
export function DemoPhone({ preset, label }: { preset: PresetId; label: string }) {
  return (
    <div className="w-full max-w-[20rem] overflow-hidden rounded-[2rem] border-4 border-brand-midnight bg-white shadow-xl">
      <div
        role="region"
        aria-label={label}
        tabIndex={0}
        data-testid="demo-phone"
        className="h-[32rem] overflow-y-auto [scrollbar-width:none] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-violet [&::-webkit-scrollbar]:hidden"
      >
        <div inert className="flex min-h-full flex-col">
          <ProfileView data={demoProfile(THEME_PRESETS[preset])} preview />
        </div>
      </div>
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
