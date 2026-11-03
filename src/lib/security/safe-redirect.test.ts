import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it.each(["/dashboard", "/dashboard/settings?tab=email", "/onboarding#step-2", "/"])("keeps %s", (path) => {
    expect(safeRedirectPath(path)).toBe(path);
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "///evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "/%2f/evil.example",
    "/%2F%2Fevil.example",
    "/%5cevil.example",
    "javascript:alert(1)",
    "evil.example",
    "",
    " /dashboard",
  ])("rejects %j", (path) => {
    expect(safeRedirectPath(path)).toBe("/dashboard");
  });

  it.each([null, undefined, 42, {}, ["/dashboard"]])("rejects non-string input %j", (value) => {
    expect(safeRedirectPath(value)).toBe("/dashboard");
  });

  it("uses a custom fallback", () => {
    expect(safeRedirectPath("//evil.example", "/login")).toBe("/login");
  });
});
