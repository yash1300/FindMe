import { describe, expect, it } from "vitest";
import { countryName, formatCount, parseRange, summarize, todayInIndia, type DailyRow } from "./summary";

const TODAY = "2026-11-04";

const row = (day: string, dimension: string, dimension_value: string, views = 0, clicks = 0, uniques = 0): DailyRow => ({
  day, dimension, dimension_value, views, clicks, uniques,
});

describe("todayInIndia", () => {
  it("uses Indian time, which is ahead of UTC", () => {
    expect(todayInIndia(new Date("2026-11-03T19:00:00Z"))).toBe("2026-11-04");
    expect(todayInIndia(new Date("2026-11-03T18:00:00Z"))).toBe("2026-11-03");
  });
});

describe("parseRange", () => {
  it.each([
    ["today", "2026-11-04"],
    ["7", "2026-10-29"],
    ["30", "2026-10-06"],
    ["90", "2026-08-07"],
  ])("reads the %s preset", (range, from) => {
    expect(parseRange({ range }, TODAY)).toEqual({ id: range, from, to: TODAY });
  });

  it("defaults to 30 days", () => {
    expect(parseRange({}, TODAY).id).toBe("30");
    expect(parseRange({ range: "nonsense" }, TODAY).id).toBe("30");
  });

  it("accepts a custom range", () => {
    expect(parseRange({ range: "custom", from: "2026-10-01", to: "2026-10-05" }, TODAY)).toEqual({ id: "custom", from: "2026-10-01", to: "2026-10-05" });
  });

  it.each([
    [{ range: "custom", from: "2026-13-01", to: "2026-10-05" }],
    [{ range: "custom", from: "2026-02-30", to: "2026-03-05" }],
    [{ range: "custom", from: "2026-10-05", to: "2026-10-01" }],
    [{ range: "custom", from: "'; drop table x", to: "2026-10-01" }],
    [{ range: "custom", from: ["2026-10-01"], to: "2026-10-05" }],
    [{ range: "custom" }],
  ])("falls back for %j", (params) => {
    expect(parseRange(params, TODAY).id).toBe("30");
  });

  it("stops at today, and caps very long ranges", () => {
    expect(parseRange({ range: "custom", from: "2026-11-01", to: "2030-01-01" }, TODAY).to).toBe(TODAY);
    expect(parseRange({ range: "custom", from: "2000-01-01", to: TODAY }, TODAY).from).toBe("2025-11-04");
  });
});

describe("summarize", () => {
  const range = { from: "2026-11-01", to: "2026-11-03" };

  it("totals views, clicks and estimated uniques, and works out CTR", () => {
    const result = summarize(
      [row("2026-11-01", "total", "", 10, 2, 8), row("2026-11-03", "total", "", 30, 6, 20)],
      range,
    );
    expect(result).toMatchObject({ views: 40, clicks: 8, uniques: 28, ctr: 20 });
  });

  it("fills empty days with zeros, in order", () => {
    const result = summarize([row("2026-11-02", "total", "", 5, 1, 4)], range);
    expect(result.series).toEqual([
      { day: "2026-11-01", views: 0, clicks: 0 },
      { day: "2026-11-02", views: 5, clicks: 1 },
      { day: "2026-11-03", views: 0, clicks: 0 },
    ]);
  });

  it("has no CTR with no views, rather than dividing by zero", () => {
    expect(summarize([], range).ctr).toBeNull();
  });

  it("ignores rows outside the range", () => {
    expect(summarize([row("2026-10-31", "total", "", 99), row("2026-11-04", "total", "", 99)], range).views).toBe(0);
  });

  it("adds breakdowns across days and sorts them, largest first", () => {
    const result = summarize(
      [
        row("2026-11-01", "device", "mobile", 3),
        row("2026-11-02", "device", "mobile", 4),
        row("2026-11-02", "device", "desktop", 9),
        row("2026-11-02", "country", "IN", 9),
      ],
      range,
    );
    expect(result.breakdowns.device).toEqual([{ value: "desktop", views: 9 }, { value: "mobile", views: 7 }]);
    expect(result.breakdowns.country).toEqual([{ value: "IN", views: 9 }]);
    expect(result.breakdowns.os).toEqual([]);
  });

  it("ranks links by clicks", () => {
    const result = summarize(
      [row("2026-11-01", "block", "a", 0, 2), row("2026-11-02", "block", "b", 0, 5), row("2026-11-03", "block", "a", 0, 1)],
      range,
    );
    expect(result.blockClicks).toEqual([{ blockId: "b", clicks: 5 }, { blockId: "a", clicks: 3 }]);
  });
});

describe("formatting", () => {
  it("uses Indian number grouping", () => {
    expect(formatCount(1234567)).toBe("12,34,567");
  });

  it("names countries, and copes with odd codes", () => {
    expect(countryName("IN")).toBe("India");
    expect(countryName("not-a-code")).toBe("not-a-code");
  });
});
