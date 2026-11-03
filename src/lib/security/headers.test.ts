import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, buildSecurityHeaders } from "./headers";

const supabaseUrl = "https://abc.supabase.co";

describe("buildContentSecurityPolicy", () => {
  it("blocks framing, plugins and base tag hijacking", () => {
    const csp = buildContentSecurityPolicy({ isProduction: true });
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it("allows eval only in development", () => {
    expect(buildContentSecurityPolicy({ isProduction: true })).not.toContain("unsafe-eval");
    expect(buildContentSecurityPolicy({ isProduction: false })).toContain("unsafe-eval");
  });

  it("allows only the configured Supabase origin", () => {
    const csp = buildContentSecurityPolicy({ isProduction: true, supabaseUrl });
    expect(csp).toContain(`connect-src 'self' ${supabaseUrl} wss://abc.supabase.co`);
    expect(csp).not.toMatch(/connect-src[^;]*\*/);
  });
});

describe("buildSecurityHeaders", () => {
  const names = (isProduction: boolean) =>
    buildSecurityHeaders({ isProduction, supabaseUrl }).map((header) => header.key);

  it("includes the core headers", () => {
    expect(names(true)).toEqual(
      expect.arrayContaining([
        "Content-Security-Policy",
        "X-Frame-Options",
        "X-Content-Type-Options",
        "Referrer-Policy",
        "Permissions-Policy",
      ]),
    );
  });

  it("sends HSTS only in production, so local http keeps working", () => {
    expect(names(true)).toContain("Strict-Transport-Security");
    expect(names(false)).not.toContain("Strict-Transport-Security");
  });
});
