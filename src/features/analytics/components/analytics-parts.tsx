import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type AnalyticsSummary, formatCount } from "../summary";

export function MetricCards({ summary }: { summary: AnalyticsSummary }) {
  const metrics = [
    { label: "Profile views", value: formatCount(summary.views), testId: "metric-views" },
    { label: "Estimated visitors", value: formatCount(summary.uniques), testId: "metric-uniques" },
    { label: "Link clicks", value: formatCount(summary.clicks), testId: "metric-clicks" },
    { label: "Click-through rate", value: summary.ctr === null ? "–" : `${summary.ctr.toFixed(1)}%`, testId: "metric-ctr" },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.label}>
          <CardHeader>
            <CardDescription>{metric.label}</CardDescription>
            <CardTitle className="text-3xl" data-testid={metric.testId}>{metric.value}</CardTitle>
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
  barColor = "#7657f6",
}: {
  rows: { label: string; value: number }[];
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
              style={{ width: `calc(${(row.value / max) * 100}% - 3.5rem)`, minWidth: "2px", background: barColor }}
            />
            <span className="shrink-0 text-xs font-medium">{formatCount(row.value)}</span>
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
