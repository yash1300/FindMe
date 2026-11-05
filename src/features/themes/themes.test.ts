import { describe, expect, it, vi } from "vitest";
import { contrastRatio, readableOn, themeToStyle } from "./css";
import { DEFAULT_PRESET, parseTheme, PRESET_LIST, THEME_PRESETS } from "./presets";
import { PRESET_IDS, themeSchema } from "./schema";

describe("presets", () => {
  it("provides the 10 themes in the spec", () => {
    expect(PRESET_IDS).toHaveLength(10);
    expect(PRESET_LIST).toHaveLength(10);
  });

  it.each(PRESET_IDS)("%s is valid and labelled with its own id", (id) => {
    expect(themeSchema.safeParse(THEME_PRESETS[id]).success).toBe(true);
    expect(THEME_PRESETS[id].preset).toBe(id);
  });

  it.each(PRESET_IDS.filter((id) => THEME_PRESETS[id].background.type === "solid"))(
    "%s has readable body text",
    (id) => {
      const { colors, background } = THEME_PRESETS[id];
      expect(contrastRatio(colors.text, background.color)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(PRESET_IDS.filter((id) => THEME_PRESETS[id].buttons.style === "filled"))("%s has readable buttons", (id) => {
    const { colors } = THEME_PRESETS[id];
    expect(contrastRatio(colors.buttonText, colors.buttonBackground)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("every preset is legible wherever its colours land", () => {
  const vars = (id: (typeof PRESET_IDS)[number]) => themeToStyle(THEME_PRESETS[id]) as unknown as Record<string, string>;

  it.each(PRESET_IDS)("%s: buttons, cards and forms", (id) => {
    const { colors, background } = THEME_PRESETS[id];
    const style = vars(id);
    expect(contrastRatio(style["--fm-button-text"], colors.buttonBackground)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(style["--fm-card-ink"], colors.cardBackground)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(style["--fm-card-muted"], colors.cardBackground)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(style["--fm-card-accent"], colors.cardBackground)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(style["--fm-field-ink"], background.color)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(style["--fm-avatar-ink"], colors.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(PRESET_IDS.filter((id) => THEME_PRESETS[id].background.type === "solid"))("%s: secondary text on the page", (id) => {
    expect(contrastRatio(vars(id)["--fm-muted"], THEME_PRESETS[id].background.color)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(PRESET_IDS.filter((id) => THEME_PRESETS[id].background.type === "gradient"))("%s: text at both ends of the gradient", (id) => {
    const { colors, background } = THEME_PRESETS[id];
    for (const stop of [background.gradientFrom, background.gradientTo]) {
      expect(contrastRatio(colors.text, stop)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colors.muted, stop)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("repairs a page saved with white text on white cards, and keeps colours that already work", () => {
    expect(readableOn("#ffffff", "#ffffff")).toBe("#111827");
    expect(readableOn("#111111", "#000000")).toBe("#ffffff");
    expect(readableOn("#9f1239", "#ffffff")).toBe("#9f1239");
  });
});

describe("parseTheme", () => {
  it("returns a valid stored theme", () => {
    expect(parseTheme(THEME_PRESETS.dark).preset).toBe("dark");
  });

  it.each([{}, null, "red", { preset: "dark" }, { ...THEME_PRESETS.dark, preset: "nope" }])(
    "falls back to the default for %j",
    (raw) => {
      expect(parseTheme(raw).preset).toBe(DEFAULT_PRESET);
    },
  );
});

describe("theme safety", () => {
  const withText = (text: string) => ({ ...THEME_PRESETS.dark, colors: { ...THEME_PRESETS.dark.colors, text } });

  it.each([
    "red;background:url(https://evil.example/x)",
    "#fff",
    "#ffffff;}body{display:none}",
    "url(https://evil.example)",
    "expression(alert(1))",
    "var(--x)",
  ])("rejects the colour %s", (value) => {
    expect(themeSchema.safeParse(withText(value)).success).toBe(false);
  });

  it("rejects unknown fonts and outside images", () => {
    const theme = THEME_PRESETS.dark;
    expect(
      themeSchema.safeParse({ ...theme, typography: { ...theme.typography, bodyFont: "x;}*{display:none}" } }).success,
    ).toBe(false);
    expect(
      themeSchema.safeParse({ ...theme, background: { ...theme.background, imagePath: 'https://evil.example/"); x' } }).success,
    ).toBe(false);
  });

  it("strips unknown keys", () => {
    const parsed = themeSchema.parse({ ...THEME_PRESETS.dark, customCss: "body{display:none}" });
    expect(parsed).not.toHaveProperty("customCss");
  });
});

describe("themeToStyle", () => {
  const style = (theme: Parameters<typeof themeToStyle>[0]) => themeToStyle(theme) as Record<string, string>;

  it("maps colours and fonts to variables", () => {
    const result = style(THEME_PRESETS.dark);
    expect(result["--fm-bg"]).toBe("#0b0f19");
    expect(result["--fm-heading-font"]).toBe("var(--fm-font-space-grotesk)");
  });

  it("never gives cards or fields a pill radius, which would clip their contents", () => {
    const pill = { ...THEME_PRESETS.modern, buttons: { ...THEME_PRESETS.modern.buttons, shape: "pill" as const } };
    const result = style(pill);
    expect(result["--fm-radius"]).toBe("9999px");
    expect(parseFloat(result["--fm-card-radius"])).toBeLessThanOrEqual(2);
    expect(parseFloat(result["--fm-field-radius"])).toBeLessThanOrEqual(1);
  });

  it("builds gradients", () => {
    expect(style(THEME_PRESETS.gradient)["--fm-bg-image"]).toBe("linear-gradient(135deg, #6d4aec, #be185d)");
  });

  it("uses a validated image path, with an overlay for legibility", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.example.test");
    const path = "11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.png";
    const theme = { ...THEME_PRESETS.dark, background: { ...THEME_PRESETS.dark.background, type: "image" as const, imagePath: path, imageOverlay: 50 } };
    const image = style(theme)["--fm-bg-image"];
    expect(image).toContain("rgb(0 0 0 / 0.5)");
    expect(image).toContain(`https://db.example.test/storage/v1/object/public/profile-media/${path}`);
    vi.unstubAllEnvs();
  });
});

describe("contrastRatio", () => {
  it("matches known values", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1);
  });
});
