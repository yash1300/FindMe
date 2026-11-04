import type { Metadata } from "next";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarList, BreakdownCard, MetricCards } from "@/features/analytics/components/analytics-parts";
import { TrendChart } from "@/features/analytics/components/trend-chart";
import { getDailyRows } from "@/features/analytics/queries";
import { countryName, formatDay, parseRange, PRESET_RANGES, summarize, todayInIndia } from "@/features/analytics/summary";
import { requireOnboardedUser } from "@/features/auth/session";
import { BLOCK_DEFINITIONS } from "@/features/blocks/definitions";
import { isBlockType } from "@/features/blocks/schema";
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
  const [rows, { blocks }] = await Promise.all([getDailyRows(profile.id, range.from, range.to), getOwnerContent(profile.id)]);
  const summary = summarize(rows, range);

  const blockName = (id: string) => {
    const block = blocks.find((item) => item.id === id);
    if (!block) return "Deleted link";
    const title = block.config.title ?? block.config.text;
    if (typeof title === "string") return title;
    return isBlockType(block.type) ? BLOCK_DEFINITIONS[block.type].label : "Link";
  };

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

      <MetricCards summary={summary} />

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
                rows={summary.blockClicks.slice(0, 10).map((item) => ({ label: blockName(item.blockId), value: item.clicks }))}
              />
            </CardContent>
          </Card>

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

      <p className="text-xs text-muted-foreground">
        Visitor counts are estimates. We don&apos;t store IP addresses or track people across days or pages, so someone returning on a later day counts again. Bots, your own previews, and visitors who ask not to be tracked aren&apos;t counted. Detailed records are deleted after 30 days; daily totals are kept.
      </p>
    </div>
  );
}
