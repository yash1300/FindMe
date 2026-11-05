import type { CSSProperties } from "react";
import { publicMediaUrl } from "@/features/media/paths";
import type { Theme } from "./schema";

const BUTTON_RADIUS = { square: "0px", rounded: "0.75rem", pill: "9999px" } as const;
// Separate from the button radius: at 9999px, a tall card or text box would become an
// ellipse and clip its own contents.
const CARD_RADIUS = { square: "0px", rounded: "1rem", pill: "1.5rem" } as const;
const FIELD_RADIUS = { square: "0px", rounded: "0.5rem", pill: "0.75rem" } as const;
const SHADOWS = {
  none: "none",
  small: "0 1px 2px rgb(0 0 0 / 0.12)",
  medium: "0 6px 16px rgb(0 0 0 / 0.14)",
  large: "0 14px 32px rgb(0 0 0 / 0.22)",
  hard: "4px 4px 0 var(--fm-shadow-color)",
} as const;
const SPACING = { compact: "0.5rem", normal: "0.875rem", relaxed: "1.375rem" } as const;
const WIDTHS = { narrow: "26rem", normal: "36rem", wide: "48rem" } as const;
const AVATAR_SIZES = { small: "4.5rem", medium: "6.5rem", large: "8.5rem" } as const;
const AVATAR_RADIUS = { circle: "9999px", rounded: "1.25rem", square: "0px" } as const;
const COVER_HEIGHTS = { small: "7rem", medium: "11rem", large: "16rem" } as const;
const SCALES = { small: "0.9375rem", medium: "1rem", large: "1.125rem" } as const;

export function themeFontVariable(font: string): string {
  return `var(--fm-font-${font.replaceAll("_", "-")})`;
}

function backgroundImage(theme: Theme): string {
  const { background } = theme;
  if (background.type === "gradient") {
    return `linear-gradient(${background.gradientAngle}deg, ${background.gradientFrom}, ${background.gradientTo})`;
  }
  if (background.type === "image") {
    const url = publicMediaUrl(background.imagePath);
    if (url) {
      const overlay = background.imageOverlay / 100;
      // The path was validated, so this can't break out of url(), and the overlay keeps text legible.
      return `linear-gradient(rgb(0 0 0 / ${overlay}), rgb(0 0 0 / ${overlay})), url("${url}")`;
    }
  }
  return "none";
}

/** Turns a theme into CSS variables. All values come from validated enums, hex colours or numbers. */
export function themeToStyle(theme: Theme): CSSProperties {
  const { colors, buttons, layout, avatar, cover, typography, background } = theme;
  // A page's chosen colours can't always work everywhere: white text suits a gradient, but not the
  // white card sitting on it. These keep each pairing legible, including on pages already saved.
  const pageMuted = background.type === "solid" ? readableOn(colors.muted, background.color) : colors.muted;
  return {
    "--fm-bg": background.color,
    "--fm-bg-image": backgroundImage(theme),
    "--fm-text": colors.text,
    "--fm-muted": pageMuted,
    "--fm-accent": colors.accent,
    "--fm-button-bg": colors.buttonBackground,
    "--fm-button-text": readableOn(colors.buttonText, colors.buttonBackground),
    "--fm-card-bg": colors.cardBackground,
    "--fm-card-ink": readableOn(colors.text, colors.cardBackground),
    "--fm-card-muted": readableOn(colors.muted, colors.cardBackground),
    "--fm-card-accent": readableOn(colors.accent, colors.cardBackground),
    "--fm-field-ink": readableOn(colors.text, background.color),
    "--fm-avatar-ink": readableOn(background.color, colors.accent),
    "--fm-border": colors.border,
    "--fm-shadow-color": colors.border,
    "--fm-heading-font": themeFontVariable(typography.headingFont),
    "--fm-body-font": themeFontVariable(typography.bodyFont),
    "--fm-font-size": SCALES[typography.scale],
    "--fm-radius": BUTTON_RADIUS[buttons.shape],
    "--fm-card-radius": CARD_RADIUS[buttons.shape],
    "--fm-field-radius": FIELD_RADIUS[buttons.shape],
    "--fm-border-width": `${buttons.borderWidth}px`,
    "--fm-shadow": SHADOWS[buttons.shadow],
    "--fm-gap": SPACING[layout.spacing],
    "--fm-width": WIDTHS[layout.width],
    "--fm-avatar-size": AVATAR_SIZES[avatar.size],
    "--fm-avatar-radius": AVATAR_RADIUS[avatar.shape],
    "--fm-cover-height": COVER_HEIGHTS[cover.height],
  } as CSSProperties;
}

/** WCAG relative luminance, used to warn about unreadable colour choices in the editor. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const [r, g, b] = channels.map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** The colour as chosen if it can be read on this background, otherwise dark or light ink, whichever reads best. */
export function readableOn(color: string, background: string): string {
  if (contrastRatio(color, background) >= 4.5) return color;
  return contrastRatio("#111827", background) >= contrastRatio("#ffffff", background) ? "#111827" : "#ffffff";
}
