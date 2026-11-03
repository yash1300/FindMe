import { describe, expect, it } from "vitest";
import { isSafeMailto, normalizeHttpUrl, phoneSchema } from "./urls";

describe("normalizeHttpUrl", () => {
  it.each([
    ["https://example.com", "https://example.com/"],
    ["http://example.com/a?b=c#d", "http://example.com/a?b=c#d"],
    ["example.com", "https://example.com/"],
    ["example.com/path", "https://example.com/path"],
    ["example.com:8080/x", "https://example.com:8080/x"],
    ["  https://example.com  ", "https://example.com/"],
    ["https://münchen.example", "https://xn--mnchen-3ya.example/"],
  ])("accepts %s", (input, expected) => {
    expect(normalizeHttpUrl(input)).toBe(expected);
  });

  it.each([
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    "\u0001javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "ftp://example.com",
    "mailto:a@example.com",
    "//evil.example",
    "https://user:pass@example.com",
    "https://example.com@evil.example",
    "https:\\\\evil.example",
    "http://localhost:3000",
    "https://intranet/",
    "not a url",
    "",
    `https://example.com/${"a".repeat(2050)}`,
  ])("rejects %j", (input) => {
    expect(normalizeHttpUrl(input)).toBeNull();
  });

  it.each([null, undefined, 1, {}, []])("rejects non-string %j", (input) => {
    expect(normalizeHttpUrl(input)).toBeNull();
  });
});

describe("phoneSchema", () => {
  it("strips formatting", () => {
    expect(phoneSchema.parse("+91 (98765) 43-210")).toBe("+919876543210");
  });

  it.each(["abc", "12", "tel:123456", "+91<script>", "1".repeat(16)])("rejects %s", (input) => {
    expect(phoneSchema.safeParse(input).success).toBe(false);
  });
});

describe("isSafeMailto", () => {
  it("accepts a plain address", () => {
    expect(isSafeMailto("mailto:a@example.com")).toBe(true);
  });

  it("rejects header injection and other schemes", () => {
    expect(isSafeMailto("mailto:a@example.com?bcc=x@evil.example")).toBe(false);
    expect(isSafeMailto("javascript:a@example.com")).toBe(false);
  });
});
