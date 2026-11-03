"use client";

import type { ReactNode } from "react";
import { SelectField } from "@/components/forms/select-field";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/features/media/components/image-upload";
import { contrastRatio } from "../css";
import { FONT_LABELS } from "../fonts";
import { PRESET_LABELS, PRESET_LIST } from "../presets";
import { FONT_IDS, type PresetId, type Theme } from "../schema";

export type ThemePatch = <K extends keyof Theme>(section: K, values: Partial<Theme[K]>, groupKey?: string) => void;

const options = <T extends string>(entries: Record<T, string>) =>
  Object.entries<string>(entries).map(([value, label]) => ({ value, label }));

const FONT_OPTIONS = FONT_IDS.map((id) => ({ value: id, label: FONT_LABELS[id] }));

function Section({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-xl border bg-card">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">{title}</summary>
      <div className="grid gap-4 border-t p-4">{children}</div>
    </details>
  );
}

function ColorField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id}>{label}</Label>
      <span className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">{value}</span>
        <input id={id} type="color" value={value} onChange={(event) => onChange(event.target.value)} className="size-8 cursor-pointer rounded-md border bg-transparent p-0.5" />
      </span>
    </div>
  );
}

function ToggleField({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex items-center justify-between gap-3 text-sm font-medium">
      {label}
      <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-brand-violet" />
    </label>
  );
}

function RangeField({ id, label, value, min, max, suffix, onChange }: { id: string; label: string; value: number; min: number; max: number; suffix: string; onChange: (value: number) => void }) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <span className="font-mono text-xs text-muted-foreground">{value}{suffix}</span>
      </div>
      <input id={id} type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-brand-violet" />
    </div>
  );
}

function ContrastWarning({ foreground, background, label }: { foreground: string; background: string; label: string }) {
  if (contrastRatio(foreground, background) >= 4.5) return null;
  return <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-950">{label} may be hard to read against this background.</p>;
}

export function PresetPicker({ current, onChoose }: { current: PresetId; onChoose: (preset: PresetId) => void }) {
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-2">
      {PRESET_LIST.map((preset) => {
        const { background, colors, buttons } = preset;
        const fill = background.type === "gradient" ? `linear-gradient(${background.gradientAngle}deg, ${background.gradientFrom}, ${background.gradientTo})` : background.color;
        return (
          <button
            key={preset.preset}
            type="button"
            role="radio"
            aria-checked={current === preset.preset}
            onClick={() => onChoose(preset.preset)}
            className={`rounded-lg border p-1.5 text-left text-xs font-medium transition-colors hover:border-brand-violet focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${current === preset.preset ? "border-brand-violet ring-1 ring-brand-violet" : ""}`}
          >
            <span aria-hidden className="mb-1.5 flex h-14 flex-col items-center justify-center gap-1 rounded-md border" style={{ background: fill }}>
              <span className="h-2 w-10 rounded-sm" style={{ background: buttons.style === "outline" ? "transparent" : colors.buttonBackground, border: `1px solid ${colors.border}`, opacity: buttons.style === "glass" ? 0.5 : 1 }} />
              <span className="h-2 w-10 rounded-sm" style={{ background: buttons.style === "outline" ? "transparent" : colors.buttonBackground, border: `1px solid ${colors.border}`, opacity: buttons.style === "glass" ? 0.5 : 1 }} />
            </span>
            {PRESET_LABELS[preset.preset]}
          </button>
        );
      })}
    </div>
  );
}

export function ThemeControls({ theme, patch, onPreset }: { theme: Theme; patch: ThemePatch; onPreset: (preset: PresetId) => void }) {
  const { background, colors, typography, buttons, layout, avatar, cover, effects } = theme;
  const pageColor = background.type === "solid" ? background.color : background.type === "gradient" ? background.gradientFrom : "#000000";

  return (
    <div className="grid gap-2">
      <Section title="Theme" open>
        <PresetPicker current={theme.preset} onChoose={onPreset} />
      </Section>

      <Section title="Background">
        <SelectField
          id="bg-type"
          label="Type"
          value={background.type}
          options={options({ solid: "Solid colour", gradient: "Gradient", image: "Image" })}
          onChange={(event) => patch("background", { type: event.target.value as Theme["background"]["type"] })}
        />
        {background.type === "solid" ? (
          <ColorField id="bg-color" label="Colour" value={background.color} onChange={(color) => patch("background", { color }, "bg-color")} />
        ) : null}
        {background.type === "gradient" ? (
          <>
            <ColorField id="bg-from" label="From" value={background.gradientFrom} onChange={(gradientFrom) => patch("background", { gradientFrom }, "bg-from")} />
            <ColorField id="bg-to" label="To" value={background.gradientTo} onChange={(gradientTo) => patch("background", { gradientTo }, "bg-to")} />
            <RangeField id="bg-angle" label="Angle" min={0} max={360} suffix="°" value={background.gradientAngle} onChange={(gradientAngle) => patch("background", { gradientAngle }, "bg-angle")} />
          </>
        ) : null}
        {background.type === "image" ? (
          <>
            <ImageUpload label="Background image" value={background.imagePath} onChange={(imagePath) => patch("background", { imagePath })} />
            <RangeField id="bg-overlay" label="Darken" min={0} max={80} suffix="%" value={background.imageOverlay} onChange={(imageOverlay) => patch("background", { imageOverlay }, "bg-overlay")} />
          </>
        ) : null}
      </Section>

      <Section title="Colours">
        <ColorField id="c-text" label="Text" value={colors.text} onChange={(text) => patch("colors", { text }, "c-text")} />
        <ContrastWarning foreground={colors.text} background={pageColor} label="Text" />
        <ColorField id="c-muted" label="Secondary text" value={colors.muted} onChange={(muted) => patch("colors", { muted }, "c-muted")} />
        <ColorField id="c-accent" label="Accent" value={colors.accent} onChange={(accent) => patch("colors", { accent }, "c-accent")} />
        <ColorField id="c-btn-bg" label="Button" value={colors.buttonBackground} onChange={(buttonBackground) => patch("colors", { buttonBackground }, "c-btn-bg")} />
        <ColorField id="c-btn-text" label="Button text" value={colors.buttonText} onChange={(buttonText) => patch("colors", { buttonText }, "c-btn-text")} />
        {buttons.style === "filled" ? <ContrastWarning foreground={colors.buttonText} background={colors.buttonBackground} label="Button text" /> : null}
        <ColorField id="c-card" label="Cards" value={colors.cardBackground} onChange={(cardBackground) => patch("colors", { cardBackground }, "c-card")} />
        <ColorField id="c-border" label="Borders" value={colors.border} onChange={(border) => patch("colors", { border }, "c-border")} />
      </Section>

      <Section title="Typography">
        <SelectField id="t-heading" label="Heading font" value={typography.headingFont} options={FONT_OPTIONS} onChange={(event) => patch("typography", { headingFont: event.target.value as Theme["typography"]["headingFont"] })} />
        <SelectField id="t-body" label="Body font" value={typography.bodyFont} options={FONT_OPTIONS} onChange={(event) => patch("typography", { bodyFont: event.target.value as Theme["typography"]["bodyFont"] })} />
        <SelectField id="t-scale" label="Text size" value={typography.scale} options={options({ small: "Small", medium: "Medium", large: "Large" })} onChange={(event) => patch("typography", { scale: event.target.value as Theme["typography"]["scale"] })} />
      </Section>

      <Section title="Buttons">
        <SelectField id="b-style" label="Style" value={buttons.style} options={options({ filled: "Filled", outline: "Outline", soft: "Soft", glass: "Glass" })} onChange={(event) => patch("buttons", { style: event.target.value as Theme["buttons"]["style"] })} />
        <SelectField id="b-shape" label="Shape" value={buttons.shape} options={options({ square: "Square", rounded: "Rounded", pill: "Pill" })} onChange={(event) => patch("buttons", { shape: event.target.value as Theme["buttons"]["shape"] })} />
        <RangeField id="b-border" label="Border" min={0} max={4} suffix="px" value={buttons.borderWidth} onChange={(borderWidth) => patch("buttons", { borderWidth }, "b-border")} />
        <SelectField id="b-shadow" label="Shadow" value={buttons.shadow} options={options({ none: "None", small: "Small", medium: "Medium", large: "Large", hard: "Hard edge" })} onChange={(event) => patch("buttons", { shadow: event.target.value as Theme["buttons"]["shadow"] })} />
        <ToggleField id="b-icons" label="Show icons" checked={buttons.icons} onChange={(icons) => patch("buttons", { icons })} />
      </Section>

      <Section title="Layout">
        <SelectField id="l-align" label="Alignment" value={layout.align} options={options({ center: "Centred", left: "Left" })} onChange={(event) => patch("layout", { align: event.target.value as Theme["layout"]["align"] })} />
        <SelectField id="l-spacing" label="Spacing" value={layout.spacing} options={options({ compact: "Compact", normal: "Normal", relaxed: "Relaxed" })} onChange={(event) => patch("layout", { spacing: event.target.value as Theme["layout"]["spacing"] })} />
        <SelectField id="l-width" label="Width" value={layout.width} options={options({ narrow: "Narrow", normal: "Normal", wide: "Wide" })} onChange={(event) => patch("layout", { width: event.target.value as Theme["layout"]["width"] })} />
        <SelectField id="l-surface" label="Content panel" value={layout.surface} options={options({ none: "None", card: "Card", glass: "Glass" })} onChange={(event) => patch("layout", { surface: event.target.value as Theme["layout"]["surface"] })} />
      </Section>

      <Section title="Profile picture and cover">
        <SelectField id="a-shape" label="Picture shape" value={avatar.shape} options={options({ circle: "Circle", rounded: "Rounded", square: "Square" })} onChange={(event) => patch("avatar", { shape: event.target.value as Theme["avatar"]["shape"] })} />
        <SelectField id="a-size" label="Picture size" value={avatar.size} options={options({ small: "Small", medium: "Medium", large: "Large" })} onChange={(event) => patch("avatar", { size: event.target.value as Theme["avatar"]["size"] })} />
        <ToggleField id="a-ring" label="Ring around picture" checked={avatar.ring} onChange={(ring) => patch("avatar", { ring })} />
        <SelectField id="c-height" label="Cover height" value={cover.height} options={options({ small: "Small", medium: "Medium", large: "Large" })} onChange={(event) => patch("cover", { height: event.target.value as Theme["cover"]["height"] })} />
        <p className="text-xs text-muted-foreground">Upload your picture and cover on the My Page screen.</p>
      </Section>

      <Section title="Effects">
        <SelectField id="e-animation" label="Entrance animation" value={effects.animation} options={options({ none: "None", fade: "Fade", rise: "Rise", pop: "Pop" })} onChange={(event) => patch("effects", { animation: event.target.value as Theme["effects"]["animation"] })} />
        <SelectField id="e-hover" label="Button hover" value={effects.hover} options={options({ none: "None", lift: "Lift", grow: "Grow" })} onChange={(event) => patch("effects", { hover: event.target.value as Theme["effects"]["hover"] })} />
      </Section>
    </div>
  );
}
