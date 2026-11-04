// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/features/themes/css";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
}

const light = tokens(":root");
const dark = { ...light, ...tokens(".dark") };

describe.each([["light", light], ["dark", dark]])("%s palette", (_name, t) => {
  it.each([
    ["body text", "--foreground", "--background", 7],
    ["card text", "--card-foreground", "--card", 7],
    ["secondary text on the page", "--muted-foreground", "--background", 4.5],
    ["secondary text on cards", "--muted-foreground", "--card", 4.5],
    ["secondary text on muted surfaces", "--muted-foreground", "--muted", 4.5],
    ["primary buttons", "--primary-foreground", "--primary", 4.5],
    ["violet accent text", "--brand-violet", "--background", 4.5],
    ["errors", "--destructive", "--card", 4.5],
    ["chart views line", "--chart-views", "--card", 3],
    ["chart clicks line", "--chart-clicks", "--card", 3],
    ["focus ring", "--ring", "--background", 3],
  ])("%s are readable", (_label, fg, bg, minimum) => {
    expect(contrastRatio(t[fg], t[bg])).toBeGreaterThanOrEqual(minimum);
  });

  it("avoids pure black and white backgrounds, which cause glare", () => {
    expect(t["--background"]).not.toBe("#ffffff");
    expect(t["--background"]).not.toBe("#000000");
    expect(contrastRatio(t["--foreground"], t["--background"])).toBeLessThan(18);
  });
});
