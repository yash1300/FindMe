import { describe, expect, it } from "vitest";
import { usernameSchema } from "./schema";

describe("usernameSchema", () => {
  it.each(["asha", "asha_k", "asha-k", "a1b", "123", "a".repeat(30)])("accepts %s", (name) => {
    expect(usernameSchema.safeParse(name).success).toBe(true);
  });

  it("lowercases and trims, so uniqueness is case-insensitive", () => {
    expect(usernameSchema.parse("  AshaK ")).toBe("ashak");
  });

  it.each([
    ["too short", "ab"],
    ["too long", "a".repeat(31)],
    ["space", "asha k"],
    ["dot", "asha.k"],
    ["slash", "asha/k"],
    ["leading separator", "-asha"],
    ["trailing separator", "asha_"],
    ["double separator", "asha--k"],
    ["mixed separators", "asha-_k"],
    ["non-latin", "आशा"],
    ["homoglyph", "аsha"],
    ["markup", "<script>"],
    ["path traversal", "../admin"],
    ["empty", ""],
  ])("rejects %s", (_label, name) => {
    expect(usernameSchema.safeParse(name).success).toBe(false);
  });

  it.each(["admin", "ADMIN", "login", "api", "findme", "fuck"])("rejects blocked name %s", (name) => {
    const result = usernameSchema.safeParse(name);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("This username isn't available.");
  });
});
