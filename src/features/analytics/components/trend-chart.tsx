"use client";

import { useId, useState } from "react";
import { formatCount, formatDay, type SeriesPoint } from "../summary";

const WIDTH = 720;
const HEIGHT = 240;
const MARGIN = { top: 12, right: 12, bottom: 28, left: 44 };
const VIEWS_COLOR = "var(--chart-views)";
const CLICKS_COLOR = "var(--chart-clicks)";

/** Rounds up to a clean axis maximum: 1, 2, 5 or 10 times a power of ten. */
function niceMax(value: number): number {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((candidate) => candidate * magnitude >= value) ?? 10;
  return step * magnitude;
}

/** Views and clicks over time, on one axis because both are plain counts. */
export function TrendChart({ series }: { series: SeriesPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();

  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const max = niceMax(Math.max(...series.map((point) => Math.max(point.views, point.clicks)), 1));

  const x = (index: number) => MARGIN.left + (series.length === 1 ? plotWidth / 2 : (index / (series.length - 1)) * plotWidth);
  const y = (value: number) => MARGIN.top + plotHeight - (value / max) * plotHeight;
  const line = (key: "views" | "clicks") => series.map((point, index) => `${index === 0 ? "M" : "L"}${x(index)} ${y(point[key])}`).join("");
  const area = `${line("views")}L${x(series.length - 1)} ${y(0)}L${x(0)} ${y(0)}Z`;

  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max].filter((tick) => Number.isInteger(tick));
  const labelEvery = Math.max(1, Math.ceil(series.length / 6));
  const activePoint = active === null ? null : series[active];

  function move(event: React.PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const position = ((event.clientX - box.left) / box.width) * WIDTH;
    const ratio = (position - MARGIN.left) / plotWidth;
    setActive(Math.max(0, Math.min(series.length - 1, Math.round(ratio * (series.length - 1)))));
  }

  return (
    <figure className="grid gap-3" aria-labelledby={titleId}>
      <figcaption id={titleId} className="sr-only">Views and link clicks per day. The same figures are in the table below.</figcaption>
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span aria-hidden className="h-0.5 w-4 rounded" style={{ background: VIEWS_COLOR }} /> Views</span>
        <span className="flex items-center gap-1.5"><span aria-hidden className="h-0.5 w-4 rounded" style={{ background: CLICKS_COLOR }} /> Clicks</span>
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full touch-pan-y"
          role="img"
          aria-hidden
          data-testid="trend-chart"
          onPointerMove={move}
          onPointerLeave={() => setActive(null)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={y(tick)} y2={y(tick)} stroke="var(--border)" strokeWidth={1} />
              <text x={MARGIN.left - 8} y={y(tick) + 4} textAnchor="end" fontSize={11} fill="var(--muted-foreground)">{formatCount(tick)}</text>
            </g>
          ))}
          {series.map((point, index) =>
            index % labelEvery === 0 ? (
              <text key={point.day} x={x(index)} y={HEIGHT - 8} textAnchor={series.length === 1 ? "middle" : index === 0 ? "start" : "middle"} fontSize={11} fill="var(--muted-foreground)">
                {formatDay(point.day)}
              </text>
            ) : null,
          )}
          {series.length > 1 ? <path d={area} fill={VIEWS_COLOR} opacity={0.1} /> : null}
          {series.length > 1 ? <path d={line("views")} fill="none" stroke={VIEWS_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /> : null}
          {series.length > 1 ? <path d={line("clicks")} fill="none" stroke={CLICKS_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /> : null}
          {series.length === 1 ? (
            <>
              <circle cx={x(0)} cy={y(series[0].views)} r={5} fill={VIEWS_COLOR} stroke="var(--card)" strokeWidth={2} />
              <circle cx={x(0)} cy={y(series[0].clicks)} r={5} fill={CLICKS_COLOR} stroke="var(--card)" strokeWidth={2} />
            </>
          ) : null}
          {active !== null && activePoint ? (
            <>
              <line x1={x(active)} x2={x(active)} y1={MARGIN.top} y2={y(0)} stroke="var(--muted-foreground)" strokeWidth={1} />
              <circle cx={x(active)} cy={y(activePoint.views)} r={4} fill={VIEWS_COLOR} stroke="var(--card)" strokeWidth={2} />
              <circle cx={x(active)} cy={y(activePoint.clicks)} r={4} fill={CLICKS_COLOR} stroke="var(--card)" strokeWidth={2} />
            </>
          ) : null}
        </svg>
        {active !== null && activePoint ? (
          <div
            data-testid="chart-tooltip"
            className="pointer-events-none absolute top-1 rounded-lg border bg-card px-2.5 py-1.5 text-xs shadow-sm"
            style={active > series.length / 2 ? { right: `${100 - (x(active) / WIDTH) * 100 + 1}%` } : { left: `${(x(active) / WIDTH) * 100 + 1}%` }}
          >
            <p className="text-muted-foreground">{formatDay(activePoint.day, "long")}</p>
            <p><span className="font-semibold">{formatCount(activePoint.views)}</span> views</p>
            <p><span className="font-semibold">{formatCount(activePoint.clicks)}</span> clicks</p>
          </div>
        ) : null}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground">Show as a table</summary>
        <div className="mt-2 max-h-60 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-muted-foreground"><th className="py-1 font-medium">Day</th><th className="py-1 font-medium">Views</th><th className="py-1 font-medium">Clicks</th></tr>
            </thead>
            <tbody>
              {series.map((point) => (
                <tr key={point.day} className="border-t">
                  <td className="py-1">{formatDay(point.day, "long")}</td>
                  <td className="py-1">{formatCount(point.views)}</td>
                  <td className="py-1">{formatCount(point.clicks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
