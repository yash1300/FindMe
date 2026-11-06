import type { Metadata } from "next";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarList, BreakdownCard, MetricCards } from "@/features/analytics/components/analytics-parts";
import { TrendChart } from "@/features/analytics/components/trend-chart";
import { blockNamer } from "@/features/analytics/block-name";
import { getDailyRows } from "@/features/analytics/queries";
import {
  countryName,
  formatDay,
  parseRange,
  PRESET_RANGES,
  previousRange,
  summarize,
  todayInIndia,
  weekdayAverages,
} from "@/features/analytics/summary";
import { requireOnboardedUser } from "@/features/auth/session";
import { getOwnerContent } from "@/features/profile/queries";

export const metadata: Metadata = { title: "Analytics" };

const CAPITALISE = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { profile } = await requireOnboardedUser("/dashboard/analytics");
  const range = parseRange(await searchParams, todayInIndia());
  const before = previousRange(range);
  // One read covers this period and the one before it, for comparison.
  const [rows, { blocks }] = await Promise.all([getDailyRows(profile.id, before.from, range.to), getOwnerContent(profile.id)]);
  const summary = summarize(rows, range);
  const previous = summarize(rows, before);
  const previousLabel = range.id === "today" ? "yesterday" : `the ${summary.series.length} days before`;
  const weekdays = weekdayAverages(summary.series);
  const exportQuery = new URLSearchParams({ range: range.id, from: range.from, to: range.to }).toString();

  // Links that were on show but nobody clicked, worth moving up or rewording.
  const clicked = new Set(summary.blockClicks.map((item) => item.blockId));
  const CLICKABLE = new Set(["link", "featured_link", "product_card", "email_button", "phone_button"]);
  const unclicked = summary.views >= 10 ? blocks.filter((block) => block.is_visible && CLICKABLE.has(block.type) && !clicked.has(block.id)) : [];
  const percentOfViews = (clicks: number) => (summary.views > 0 ? `${((clicks / summary.views) * 100).toFixed(1)}% of views` : undefined);

  const blockName = blockNamer(blocks);

  const hasData = summary.views > 0 || summary.clicks > 0;
  const { referrer, device, browser, os, country } = summary.breakdowns;
  const toBars = (items: { value: string; views: number }[], name: (value: string) => string = CAPITALISE) =>
    items.map((item) => ({ label: name(item.value), value: item.views }));

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          {formatDay(range.from, "long")} to {formatDay(range.to, "long")}. Days follow Indian time.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2" role="group" aria-label="Date range">
        {PRESET_RANGES.map((preset) => (
          <Link
            key={preset.id}
            href={`/dashboard/analytics?range=${preset.id}`}
            prefetch={false}
            aria-current={range.id === preset.id ? "true" : undefined}
            className={buttonVariants({ variant: range.id === preset.id ? "default" : "outline", size: "sm" })}
          >
            {preset.label}
          </Link>
        ))}
        <form method="get" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="range" value="custom" />
          <div className="grid gap-1">
            <Label htmlFor="from" className="text-xs">From</Label>
            <Input id="from" name="from" type="date" defaultValue={range.from} max={range.to} className="h-7" required />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="to" className="text-xs">To</Label>
            <Input id="to" name="to" type="date" defaultValue={range.to} className="h-7" required />
          </div>
          <Button type="submit" variant={range.id === "custom" ? "default" : "outline"} size="sm">Apply</Button>
        </form>
      </div>

      {!profile.analytics_enabled ? (
        <p role="status" className="rounded-lg bg-amber-50 dark:bg-amber-950/60 p-3 text-sm text-amber-950 dark:text-amber-100">
          Analytics is turned off for your page, so new visits aren&apos;t being counted. You can turn it back on in{" "}
          <Link href="/dashboard/my-page" prefetch={false} className="underline">My Page</Link>.
        </p>
      ) : null}

      <MetricCards summary={summary} previous={previous} previousLabel={previousLabel} />

      {hasData ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <TrendChart series={summary.series} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top links</CardTitle>
              <CardDescription>By number of clicks.</CardDescription>
            </CardHeader>
            <CardContent>
              <BarList
                barColor="var(--chart-clicks)"
                emptyText="No clicks in this period."
                rows={summary.blockClicks.slice(0, 10).map((item) => ({ label: blockName(item.blockId), value: item.clicks, detail: percentOfViews(item.clicks) }))}
              />
            </CardContent>
          </Card>

          {unclicked.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Links nobody clicked</CardTitle>
                <CardDescription>
                  Shown on your page in this period, but not clicked. Try moving them higher or giving them a clearer title on the{" "}
                  <Link href="/dashboard/links" prefetch={false} className="underline">Links page</Link>.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-1 text-sm">
                  {unclicked.slice(0, 10).map((block) => (
                    <li key={block.id} className="truncate">{blockName(block.id)}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {weekdays.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Busiest days</CardTitle>
                <CardDescription>Average views on each day of the week. A good guide to when to share your page.</CardDescription>
              </CardHeader>
              <CardContent>
                <BarList rows={weekdays.map((item) => ({ label: item.weekday, value: item.views }))} />
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <BreakdownCard title="Where visitors came from" rows={toBars(referrer)} />
            <BreakdownCard title="Devices" rows={toBars(device)} />
            <BreakdownCard title="Browsers" rows={toBars(browser)} />
            <BreakdownCard title="Operating systems" rows={toBars(os)} />
            <BreakdownCard title="Countries" rows={toBars(country, countryName)} />
          </div>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No visits in this period</CardTitle>
            <CardDescription>
              {profile.status === "published"
                ? "Share your page, and visits will show up here shortly after they happen."
                : "Publish your page and share it, and visits will show up here."}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div>
        <a href={`/dashboard/analytics/export?${exportQuery}`} className={buttonVariants({ variant: "outline", size: "sm" })} download>
          Download as CSV
        </a>
      </div>

      <p className="text-xs text-muted-foreground">
        Visitor counts are estimates. We don&apos;t store IP addresses or track people across days or pages, so someone returning on a later day counts again. Bots, your own previews, and visitors who ask not to be tracked aren&apos;t counted. Detailed records are deleted after 30 days; daily totals are kept.
      </p>
    </div>
  );
}
