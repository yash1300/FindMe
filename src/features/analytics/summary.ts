const MAX_RANGE_DAYS = 366;

export const PRESET_RANGES = [
  { id: "today", label: "Today", days: 1 },
  { id: "7", label: "7 days", days: 7 },
  { id: "30", label: "30 days", days: 30 },
  { id: "90", label: "90 days", days: 90 },
] as const;

export type DateRange = { id: string; from: string; to: string };

/** Today's date in India, as YYYY-MM-DD, matching how daily totals are stored. */
export function todayInIndia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
}

function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function isRealDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Reads the range from the URL. Anything invalid falls back to 30 days, and custom ranges are capped. */
export function parseRange(params: { range?: unknown; from?: unknown; to?: unknown }, today: string): DateRange {
  if (params.range === "custom" && isRealDate(params.from) && isRealDate(params.to)) {
    const to = params.to > today ? today : params.to;
    if (params.from <= to) {
      const from = daysBetween(params.from, to) >= MAX_RANGE_DAYS ? addDays(to, -(MAX_RANGE_DAYS - 1)) : params.from;
      return { id: "custom", from, to };
    }
  }
  const preset = PRESET_RANGES.find((item) => item.id === params.range) ?? PRESET_RANGES[2];
  return { id: preset.id, from: addDays(today, -(preset.days - 1)), to: today };
}

export type DailyRow = {
  day: string;
  dimension: string;
  dimension_value: string;
  views: number;
  clicks: number;
  uniques: number;
};

export type SeriesPoint = { day: string; views: number; clicks: number };
export type BreakdownRow = { value: string; views: number };

export type AnalyticsSummary = {
  views: number;
  uniques: number;
  clicks: number;
  /** Clicks per view, as a percentage, or null when there are no views to divide by. */
  ctr: number | null;
  series: SeriesPoint[];
  breakdowns: Record<"referrer" | "device" | "browser" | "os" | "country", BreakdownRow[]>;
  blockClicks: { blockId: string; clicks: number }[];
};

function breakdown(rows: DailyRow[], dimension: string): BreakdownRow[] {
  const sums = new Map<string, number>();
  for (const row of rows) {
    if (row.dimension === dimension) sums.set(row.dimension_value, (sums.get(row.dimension_value) ?? 0) + row.views);
  }
  return [...sums.entries()].map(([value, views]) => ({ value, views })).sort((a, b) => b.views - a.views);
}

/** Turns stored rows into figures, with empty days filled in so a quiet day shows as a zero, not a gap. */
export function summarize(rows: DailyRow[], { from, to }: Pick<DateRange, "from" | "to">): AnalyticsSummary {
  const inRange = rows.filter((row) => row.day >= from && row.day <= to);
  const totals = inRange.filter((row) => row.dimension === "total");
  const byDay = new Map(totals.map((row) => [row.day, row]));

  const series: SeriesPoint[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const row = byDay.get(day);
    series.push({ day, views: row?.views ?? 0, clicks: row?.clicks ?? 0 });
  }

  const views = totals.reduce((sum, row) => sum + row.views, 0);
  const clicks = totals.reduce((sum, row) => sum + row.clicks, 0);

  const blockSums = new Map<string, number>();
  for (const row of inRange) {
    if (row.dimension === "block") blockSums.set(row.dimension_value, (blockSums.get(row.dimension_value) ?? 0) + row.clicks);
  }

  return {
    views,
    clicks,
    // Each day has its own visitor IDs, so someone back on a later day is counted again.
    uniques: totals.reduce((sum, row) => sum + row.uniques, 0),
    ctr: views > 0 ? (clicks / views) * 100 : null,
    series,
    breakdowns: {
      referrer: breakdown(inRange, "referrer"),
      device: breakdown(inRange, "device"),
      browser: breakdown(inRange, "browser"),
      os: breakdown(inRange, "os"),
      country: breakdown(inRange, "country"),
    },
    blockClicks: [...blockSums.entries()].map(([blockId, count]) => ({ blockId, clicks: count })).sort((a, b) => b.clicks - a.clicks),
  };
}

const COUNTRY_NAMES = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["en-IN"], { type: "region" }) : null;

export function countryName(code: string): string {
  try {
    return COUNTRY_NAMES?.of(code) ?? code;
  } catch {
    return code;
  }
}

export function formatCount(value: number): string {
  return value.toLocaleString("en-IN");
}

export function formatDay(day: string, style: "short" | "long" = "short"): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    ...(style === "long" ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}
