import { z } from "zod";
import { mediaPathSchema } from "@/features/media/paths";

/**
 * A theme is data, never CSS. Each value is a colour in strict hex or one word from a fixed
 * list, so nothing a user saves can inject a style rule or load an outside resource.
 */
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour.");

export const FONT_IDS = ["geist", "inter", "poppins", "space_grotesk", "lora", "playfair", "dm_serif", "mono"] as const;
export type FontId = (typeof FONT_IDS)[number];

export const PRESET_IDS = ["minimal", "modern", "dark", "light", "glass", "gradient", "editorial", "creator", "business", "artistic"] as const;
export type PresetId = (typeof PRESET_IDS)[number];

export const themeSchema = z.object({
  preset: z.enum(PRESET_IDS),
  background: z.object({
    type: z.enum(["solid", "gradient", "image"]),
    color,
    gradientFrom: color,
    gradientTo: color,
    gradientAngle: z.number().int().min(0).max(360),
    imagePath: mediaPathSchema.nullable(),
    imageOverlay: z.number().int().min(0).max(80),
  }),
  colors: z.object({
    text: color,
    muted: color,
    accent: color,
    buttonBackground: color,
    buttonText: color,
    cardBackground: color,
    border: color,
  }),
  typography: z.object({
    headingFont: z.enum(FONT_IDS),
    bodyFont: z.enum(FONT_IDS),
    scale: z.enum(["small", "medium", "large"]),
  }),
  buttons: z.object({
    style: z.enum(["filled", "outline", "soft", "glass"]),
    shape: z.enum(["square", "rounded", "pill"]),
    borderWidth: z.number().int().min(0).max(4),
    shadow: z.enum(["none", "small", "medium", "large", "hard"]),
    icons: z.boolean(),
  }),
  layout: z.object({
    align: z.enum(["center", "left"]),
    spacing: z.enum(["compact", "normal", "relaxed"]),
    width: z.enum(["narrow", "normal", "wide"]),
    surface: z.enum(["none", "card", "glass"]),
  }),
  avatar: z.object({
    shape: z.enum(["circle", "rounded", "square"]),
    size: z.enum(["small", "medium", "large"]),
    ring: z.boolean(),
  }),
  cover: z.object({
    height: z.enum(["small", "medium", "large"]),
  }),
  effects: z.object({
    animation: z.enum(["none", "fade", "rise", "pop"]),
    hover: z.enum(["none", "lift", "grow"]),
  }),
});

export type Theme = z.infer<typeof themeSchema>;
