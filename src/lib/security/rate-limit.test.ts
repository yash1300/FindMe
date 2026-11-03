import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ rpc }),
}));

const { checkRateLimit, checkRateLimits, rateLimitKey } = await import("./rate-limit");
const rule = { limit: 1, windowSeconds: 60 };

beforeEach(() => {
  rpc.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("rateLimitKey", () => {
  it("never contains the identifier and ignores case and whitespace", () => {
    const key = rateLimitKey("login", "Asha@Example.com ");
    expect(key).not.toContain("asha");
    expect(key).toBe(rateLimitKey("login", "asha@example.com"));
  });

  it("separates scopes", () => {
    expect(rateLimitKey("a", "x")).not.toBe(rateLimitKey("b", "x"));
  });
});

describe("checkRateLimit", () => {
  it("passes through allowed and limited results", async () => {
    rpc.mockResolvedValueOnce({ data: [{ allowed: true, retry_after_seconds: 0 }], error: null });
    expect(await checkRateLimit("k", rule)).toEqual({ status: "allowed" });

    rpc.mockResolvedValueOnce({ data: [{ allowed: false, retry_after_seconds: 30 }], error: null });
    expect(await checkRateLimit("k", rule)).toEqual({ status: "limited", retryAfterSeconds: 30 });
  });

  it("fails closed on a database error, an empty result, or a thrown error", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    expect(await checkRateLimit("k", rule)).toEqual({ status: "unavailable" });

    rpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await checkRateLimit("k", rule)).toEqual({ status: "unavailable" });

    rpc.mockRejectedValueOnce(new Error("network"));
    expect(await checkRateLimit("k", rule)).toEqual({ status: "unavailable" });
  });
});

describe("checkRateLimits", () => {
  it("reports the longest wait and still counts every rule", async () => {
    rpc
      .mockResolvedValueOnce({ data: [{ allowed: false, retry_after_seconds: 10 }], error: null })
      .mockResolvedValueOnce({ data: [{ allowed: false, retry_after_seconds: 90 }], error: null })
      .mockResolvedValueOnce({ data: [{ allowed: true, retry_after_seconds: 0 }], error: null });
    const result = await checkRateLimits([["a", rule], ["b", rule], ["c", rule]]);
    expect(result).toEqual({ status: "limited", retryAfterSeconds: 90 });
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it("treats any unavailable limiter as unavailable", async () => {
    rpc
      .mockResolvedValueOnce({ data: [{ allowed: true, retry_after_seconds: 0 }], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    expect(await checkRateLimits([["a", rule], ["b", rule]])).toEqual({ status: "unavailable" });
  });
});
