import { describe, expect, it } from "vitest";
import { changePasswordSchema, emailSchema, passwordSchema, registerSchema, resetPasswordSchema } from "./schema";

const valid = {
  name: "Asha Rao",
  email: "Asha@Example.com",
  password: "correct horse battery",
  username: "AshaRao",
  consent: "on",
};

describe("passwordSchema", () => {
  it("enforces the minimum length", () => {
    expect(passwordSchema.safeParse("123456789").success).toBe(false);
    expect(passwordSchema.safeParse("1234567890").success).toBe(true);
  });

  it("measures the maximum in bytes, not characters", () => {
    expect(passwordSchema.safeParse("a".repeat(72)).success).toBe(true);
    expect(passwordSchema.safeParse("a".repeat(73)).success).toBe(false);
    // 30 characters but 90 bytes
    expect(passwordSchema.safeParse("आ".repeat(30)).success).toBe(false);
  });
});

describe("emailSchema", () => {
  it("normalises case and whitespace", () => {
    expect(emailSchema.parse("  Asha@Example.COM ")).toBe("asha@example.com");
  });

  it("rejects malformed addresses", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("normalises valid input", () => {
    const parsed = registerSchema.parse(valid);
    expect(parsed.email).toBe("asha@example.com");
    expect(parsed.username).toBe("asharao");
  });

  it("requires consent", () => {
    const result = registerSchema.safeParse({ ...valid, consent: undefined });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["consent"]);
  });

  it("rejects a reserved username", () => {
    expect(registerSchema.safeParse({ ...valid, username: "admin" }).success).toBe(false);
  });
});

describe("password confirmation", () => {
  it("must match when resetting", () => {
    const result = resetPasswordSchema.safeParse({ password: "long enough pass", confirmPassword: "different pass" });
    expect(result.error?.issues[0].path).toEqual(["confirmPassword"]);
  });

  it("must match when changing", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "old",
      password: "long enough pass",
      confirmPassword: "different pass",
    });
    expect(result.error?.issues[0].path).toEqual(["confirmPassword"]);
  });
});
