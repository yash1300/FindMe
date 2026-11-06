import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type AnalyticsSummary, formatCount, percentChange } from "../summary";

/** "Up 12%" in words and an arrow, so the direction never relies on colour alone. */
function Change({ current, previous, label }: { current: number; previous: number; label: string }) {
  const change = percentChange(current, previous);
  if (change === null) return <p className="text-xs text-muted-foreground">No data for {label} to compare</p>;
  const rounded = Math.round(change);
  const text = rounded === 0 ? "No change" : `${rounded > 0 ? "▲ Up" : "▼ Down"} ${Math.abs(rounded)}%`;
  return (
    <p className="text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{text}</span> on {label}
    </p>
  );
}

export function MetricCards({
  summary,
  previous,
  previousLabel = "the previous period",
}: {
  summary: AnalyticsSummary;
  previous?: AnalyticsSummary;
  previousLabel?: string;
}) {
  const metrics = [
    { label: "Profile views", value: formatCount(summary.views), testId: "metric-views", now: summary.views, before: previous?.views },
    { label: "Estimated visitors", value: formatCount(summary.uniques), testId: "metric-uniques", now: summary.uniques, before: previous?.uniques },
    { label: "Link clicks", value: formatCount(summary.clicks), testId: "metric-clicks", now: summary.clicks, before: previous?.clicks },
    {
      label: "Click-through rate",
      value: summary.ctr === null ? "–" : `${summary.ctr.toFixed(1)}%`,
      testId: "metric-ctr",
      now: summary.ctr ?? 0,
      before: previous?.ctr ?? undefined,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.label}>
          <CardHeader>
            <CardDescription>{metric.label}</CardDescription>
            <CardTitle className="text-3xl" data-testid={metric.testId}>{metric.value}</CardTitle>
            {metric.before !== undefined ? <Change current={metric.now} previous={metric.before} label={previousLabel} /> : null}
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

/** Ranked bars with the value at the tip, so everything is readable without hovering. */
export function BarList({
  rows,
  emptyText = "Nothing yet.",
  barColor = "var(--chart-views)",
}: {
  rows: { label: string; value: number; detail?: string }[];
  emptyText?: string;
  barColor?: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <ul className="grid gap-2.5">
      {rows.map((row) => (
        <li key={row.label} className="grid gap-1 text-sm">
          <span className="truncate">{row.label}</span>
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-2.5 rounded-r-[4px]"
              style={{ width: `calc(${(row.value / max) * 100}% - ${row.detail ? "9rem" : "3.5rem"})`, minWidth: "2px", background: barColor }}
            />
            <span className="shrink-0 text-xs font-medium">
              {formatCount(row.value)}
              {row.detail ? <span className="font-normal text-muted-foreground"> · {row.detail}</span> : null}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function BreakdownCard({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <BarList rows={rows.slice(0, 8)} />
      </CardContent>
    </Card>
  );
}
