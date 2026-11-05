import type { PresetId, Theme } from "./schema";
import { PRESET_IDS, themeSchema } from "./schema";

const BASE: Omit<Theme, "preset"> = {
  background: {
    type: "solid",
    color: "#ffffff",
    gradientFrom: "#7657f6",
    gradientTo: "#20c997",
    gradientAngle: 135,
    imagePath: null,
    imageOverlay: 40,
  },
  colors: {
    text: "#111827",
    muted: "#6b7280",
    accent: "#7657f6",
    buttonBackground: "#111827",
    buttonText: "#ffffff",
    cardBackground: "#ffffff",
    border: "#e5e7eb",
  },
  typography: { headingFont: "geist", bodyFont: "geist", scale: "medium" },
  buttons: { style: "filled", shape: "rounded", borderWidth: 1, shadow: "none", icons: true },
  layout: { align: "center", spacing: "normal", width: "normal", surface: "none" },
  avatar: { shape: "circle", size: "medium", ring: false },
  cover: { height: "medium" },
  effects: { animation: "rise", hover: "lift" },
};

type Overrides = {
  [K in keyof Omit<Theme, "preset">]?: Partial<Theme[K]>;
};

function preset(id: PresetId, overrides: Overrides): Theme {
  return {
    preset: id,
    background: { ...BASE.background, ...overrides.background },
    colors: { ...BASE.colors, ...overrides.colors },
    typography: { ...BASE.typography, ...overrides.typography },
    buttons: { ...BASE.buttons, ...overrides.buttons },
    layout: { ...BASE.layout, ...overrides.layout },
    avatar: { ...BASE.avatar, ...overrides.avatar },
    cover: { ...BASE.cover, ...overrides.cover },
    effects: { ...BASE.effects, ...overrides.effects },
  };
}

export const THEME_PRESETS: Record<PresetId, Theme> = {
  minimal: preset("minimal", {
    colors: { buttonBackground: "#ffffff", buttonText: "#111827", border: "#d1d5db" },
    buttons: { style: "outline", shape: "rounded" },
    effects: { animation: "fade", hover: "none" },
  }),
  modern: preset("modern", {
    background: { color: "#f3f4f6" },
    colors: { muted: "#4b5563", accent: "#7657f6", buttonBackground: "#7657f6", buttonText: "#ffffff" },
    typography: { headingFont: "space_grotesk", bodyFont: "inter" },
    buttons: { shape: "pill", shadow: "medium" },
  }),
  dark: preset("dark", {
    background: { color: "#0b0f19" },
    colors: {
      text: "#f9fafb",
      muted: "#9ca3af",
      accent: "#20c997",
      buttonBackground: "#1f2937",
      buttonText: "#f9fafb",
      cardBackground: "#111827",
      border: "#374151",
    },
    typography: { headingFont: "space_grotesk" },
    buttons: { shape: "rounded" },
  }),
  light: preset("light", {
    background: { color: "#fffdf8" },
    colors: { accent: "#0f766e", buttonBackground: "#111827", buttonText: "#ffffff", border: "#ece7dc" },
    typography: { headingFont: "poppins", bodyFont: "poppins" },
    buttons: { shape: "pill" },
  }),
  glass: preset("glass", {
    background: { type: "gradient", gradientFrom: "#312e81", gradientTo: "#0369a1", gradientAngle: 145 },
    colors: {
      text: "#ffffff",
      muted: "#dbeafe",
      accent: "#a5f3fc",
      buttonBackground: "#ffffff",
      buttonText: "#1e1b4b",
      cardBackground: "#ffffff",
      border: "#ffffff",
    },
    buttons: { style: "glass", shape: "pill" },
    layout: { surface: "glass" },
    avatar: { ring: true },
  }),
  gradient: preset("gradient", {
    background: { type: "gradient", gradientFrom: "#6d4aec", gradientTo: "#be185d", gradientAngle: 135 },
    colors: {
      text: "#ffffff",
      muted: "#fdf2f8",
      accent: "#fde68a",
      buttonBackground: "#ffffff",
      buttonText: "#4c1d95",
      cardBackground: "#ffffff",
      border: "#ffffff",
    },
    typography: { headingFont: "poppins", bodyFont: "poppins" },
    buttons: { shape: "pill", shadow: "large" },
    avatar: { ring: true },
    effects: { animation: "pop" },
  }),
  editorial: preset("editorial", {
    background: { color: "#f7f3ec" },
    colors: { text: "#1c1917", muted: "#57534e", accent: "#9f1239", buttonBackground: "#f7f3ec", buttonText: "#1c1917", border: "#1c1917", cardBackground: "#fffdf8" },
    typography: { headingFont: "playfair", bodyFont: "lora", scale: "large" },
    buttons: { style: "outline", shape: "square" },
    layout: { align: "left", spacing: "relaxed" },
    avatar: { shape: "square", size: "large" },
    effects: { animation: "fade", hover: "none" },
  }),
  creator: preset("creator", {
    background: { color: "#fff7ed" },
    colors: { text: "#431407", muted: "#9a3412", accent: "#c2410c", buttonBackground: "#c2410c", buttonText: "#ffffff", border: "#431407", cardBackground: "#ffffff" },
    typography: { headingFont: "dm_serif", bodyFont: "poppins" },
    buttons: { shape: "rounded", borderWidth: 2, shadow: "hard" },
    avatar: { shape: "rounded", size: "large" },
    effects: { animation: "pop", hover: "grow" },
  }),
  business: preset("business", {
    background: { color: "#f8fafc" },
    colors: { text: "#0f172a", muted: "#475569", accent: "#0f766e", buttonBackground: "#0f172a", buttonText: "#ffffff", border: "#cbd5e1" },
    typography: { headingFont: "inter", bodyFont: "inter", scale: "small" },
    buttons: { shape: "rounded", shadow: "small" },
    layout: { surface: "card", width: "wide" },
    avatar: { shape: "rounded", size: "small" },
    effects: { animation: "fade", hover: "none" },
  }),
  artistic: preset("artistic", {
    background: { type: "gradient", gradientFrom: "#0f172a", gradientTo: "#9d174d", gradientAngle: 200 },
    colors: { text: "#fef3c7", muted: "#fbcfe8", accent: "#34d399", buttonBackground: "#fde047", buttonText: "#0f172a", border: "#fde047", cardBackground: "#1e1b4b" },
    typography: { headingFont: "dm_serif", bodyFont: "mono" },
    buttons: { shape: "square", borderWidth: 2, shadow: "hard" },
    layout: { align: "left" },
    avatar: { shape: "square", ring: true },
    effects: { animation: "pop", hover: "grow" },
  }),
};

export const PRESET_LABELS: Record<PresetId, string> = {
  minimal: "Minimal",
  modern: "Modern",
  dark: "Dark",
  light: "Light",
  glass: "Glass",
  gradient: "Gradient",
  editorial: "Editorial",
  creator: "Creator",
  business: "Business",
  artistic: "Artistic",
};

export const DEFAULT_PRESET: PresetId = "modern";
export const PRESET_LIST = PRESET_IDS.map((id) => THEME_PRESETS[id]);

/** Reads a stored theme. An empty or invalid value falls back to the default, never to raw data. */
export function parseTheme(raw: unknown): Theme {
  const parsed = themeSchema.safeParse(raw);
  return parsed.success ? parsed.data : THEME_PRESETS[DEFAULT_PRESET];
}
