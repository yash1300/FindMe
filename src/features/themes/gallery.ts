import { z } from "zod";
import { type Theme, themeSchema } from "./schema";

export const themeNameSchema = z
  .string()
  .trim()
  .min(2, "Use at least 2 characters.")
  .max(40, "Use at most 40 characters.")
  .regex(/^[\p{L}\p{N} .,&'!-]+$/u, "Use letters, numbers, spaces and . , & ' ! - only.");

/**
 * The part of a theme that can be shared. A background photo belongs to its creator, so it's
 * swapped for the plain colour chosen underneath it.
 */
export function shareableTheme(theme: Theme): Theme {
  if (theme.background.type !== "image" && theme.background.imagePath === null) return theme;
  return {
    ...theme,
    background: { ...theme.background, type: theme.background.type === "image" ? "solid" : theme.background.type, imagePath: null },
  };
}

/** A theme from the gallery, checked again before anyone's page uses it. */
export function parseGalleryTheme(raw: unknown): Theme | null {
  const parsed = themeSchema.safeParse(raw);
  return parsed.success ? shareableTheme(parsed.data) : null;
}

export type GalleryTheme = { id: string; name: string; theme: Theme; useCount: number };
export type MySharedTheme = { id: string; name: string; status: "listed" | "removed"; useCount: number };
