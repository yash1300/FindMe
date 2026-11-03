// @vitest-environment node
import jsQR from "jsqr";
import { describe, expect, it } from "vitest";
import { buildShareTargets } from "./links";
import { createQrMatrix, qrToPixels, qrToSvg } from "./qr";

const URL_TO_ENCODE = "https://findme.example/asharao";

/** Decodes a code the way a phone would, so these prove it scans rather than that it looks right. */
function scan(withLogo: boolean, foreground = "#111827", background = "#ffffff") {
  const matrix = createQrMatrix(URL_TO_ENCODE, withLogo);
  const { pixels, width } = qrToPixels(matrix, foreground, background, 6);
  return jsQR(pixels, width, width)?.data;
}

describe("QR codes", () => {
  it("scan back to the profile URL", () => {
    expect(scan(false)).toBe(URL_TO_ENCODE);
  });

  it("still scan with space cut out for a logo", () => {
    expect(scan(true)).toBe(URL_TO_ENCODE);
  });

  it("scan in custom colours", () => {
    expect(scan(false, "#4c1d95", "#fef3c7")).toBe(URL_TO_ENCODE);
  });

  it("clear the middle only when a logo is used", () => {
    const withLogo = createQrMatrix(URL_TO_ENCODE, true);
    const plain = createQrMatrix(URL_TO_ENCODE, false);
    const middle = Math.floor(withLogo.size / 2);
    expect(withLogo.isDark(middle, middle)).toBe(false);
    expect(plain.size).toBeLessThanOrEqual(withLogo.size);
  });
});

describe("qrToSvg", () => {
  const matrix = createQrMatrix(URL_TO_ENCODE, false);

  it("is valid SVG with the chosen colours", () => {
    const svg = qrToSvg(matrix, { foreground: "#111827", background: "#ffffff", logo: null });
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('fill="#111827"');
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).not.toContain("<image");
  });

  it("embeds a logo", () => {
    const svg = qrToSvg(matrix, { foreground: "#000000", background: "#ffffff", logo: "data:image/png;base64,AAAA" });
    expect(svg).toContain('<image href="data:image/png;base64,AAAA"');
  });

  it("escapes values, so a crafted logo can't inject markup", () => {
    const svg = qrToSvg(matrix, { foreground: "#000000", background: "#ffffff", logo: 'x"><script>alert(1)</script>' });
    expect(svg).not.toContain("<script>");
  });
});

describe("buildShareTargets", () => {
  const targets = buildShareTargets("https://findme.example/a?x=1&y=2", "Asha & co");

  it("covers each platform in the spec", () => {
    expect(targets.map((target) => target.id)).toEqual(["whatsapp", "facebook", "x", "linkedin", "email"]);
  });

  it("encodes the URL and title", () => {
    for (const target of targets) {
      expect(target.href).toContain("https%3A%2F%2Ffindme.example%2Fa%3Fx%3D1%26y%3D2");
    }
    expect(targets.find((target) => target.id === "x")?.href).toContain("text=Asha%20%26%20co");
  });

  it("uses only expected destinations", () => {
    const hosts = targets.filter((target) => target.id !== "email").map((target) => new URL(target.href).hostname);
    expect(hosts).toEqual(["wa.me", "www.facebook.com", "x.com", "www.linkedin.com"]);
    expect(targets.find((target) => target.id === "email")?.href).toMatch(/^mailto:\?subject=/);
  });
});
