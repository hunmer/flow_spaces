"use client";

import { useId, useState } from "react";
import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useCountUp } from "@/hooks/use-count-up";
import type { UsagePoint } from "@/hooks/use-invocation-stats";
import { cx } from "@/utils/cx";

/**
 * Usage Trend Chart Card: invocation counts over the last 24 hours, one point
 * per hour, drawn as a soft gradient area under a solid line. Hovering an
 * hour swaps the headline for that hour's count. Without `data` it shows the
 * demo series (component gallery); dashboards pass the aggregated hourly
 * points from useInvocationStats.
 */

export type { UsagePoint };

/** Demo series for the component gallery: a day of invocations. */
export const USAGE_TREND_DATA: UsagePoint[] = [
  { label: "00:00", value: 12 },
  { label: "01:00", value: 6 },
  { label: "02:00", value: 4 },
  { label: "03:00", value: 3 },
  { label: "04:00", value: 5 },
  { label: "05:00", value: 9 },
  { label: "06:00", value: 18 },
  { label: "07:00", value: 34 },
  { label: "08:00", value: 58 },
  { label: "09:00", value: 76 },
  { label: "10:00", value: 91 },
  { label: "11:00", value: 84 },
  { label: "12:00", value: 69 },
  { label: "13:00", value: 72 },
  { label: "14:00", value: 88 },
  { label: "15:00", value: 95 },
  { label: "16:00", value: 82 },
  { label: "17:00", value: 64 },
  { label: "18:00", value: 47 },
  { label: "19:00", value: 38 },
  { label: "20:00", value: 29 },
  { label: "21:00", value: 22 },
  { label: "22:00", value: 17 },
  { label: "23:00", value: 13 },
];

const formatK = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k` : `${value}`;

/** The active hour's marker on the line. */
function ActiveDot({ cx: x, cy: y }: { cx?: number; cy?: number }) {
  if (x === undefined || y === undefined) return null;
  return (
    <g>
      <circle cx={x} cy={y} r={7} fill="var(--color-chart-2-active)" opacity={0.25} />
      <circle cx={x} cy={y} r={4} fill="var(--color-chart-2-active)" stroke="var(--color-background-secondary-default)" strokeWidth={2} />
    </g>
  );
}

export function UsageTrendChartCard({
  data = USAGE_TREND_DATA,
  title = "Invocations",
  caption = "Last 24 hours",
  className,
}: {
  /** One point per hour, oldest first; defaults to the demo day. */
  data?: UsagePoint[];
  /** Headline label when no hour is hovered. */
  title?: string;
  /** Caption under the headline when no hour is hovered. */
  caption?: string;
  className?: string;
} = {}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const gradientId = useId();

  const total = data.reduce((sum, point) => sum + point.value, 0);
  const hovering = activeIndex !== null && activeIndex < data.length;
  const point = hovering ? data[activeIndex] : null;

  const headlineValue = point ? point.value : total;
  const label = point ? point.label : title;
  const display = useCountUp(headlineValue);

  const yMax = Math.max(1, ...data.map((d) => d.value));

  return (
    <section
      className={cx(
        "flex h-[344px] min-w-0 flex-1 flex-col gap-6 rounded-2xl bg-background-secondary-default px-4 pt-4 pb-3",
        className,
      )}
    >
      {/* Header: label over the count-up figure */}
      <div className="flex w-full flex-col gap-0.5">
        <p className="w-full text-body-medium text-text-secondary">{label}</p>
        <p
          key={activeIndex ?? "total"}
          className="animate-number-fade text-title-1-medium whitespace-nowrap text-text-primary tabular-nums"
        >
          {display.toLocaleString("en-US")}
        </p>
        <p className="text-body-2-medium text-text-tertiary tabular-nums">
          {point ? `Total ${total.toLocaleString("en-US")}` : caption}
        </p>
      </div>

      {/* Chart */}
      <div className="min-h-0 w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 4, right: 6, bottom: 0, left: 0 }}
            onMouseMove={(state) => {
              const index = Number(state?.activeTooltipIndex);
              if (state?.isTooltipActive && Number.isFinite(index)) setActiveIndex(index);
            }}
            onMouseLeave={() => setActiveIndex(null)}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis
              width={44}
              domain={[0, yMax * 1.1]}
              tickCount={4}
              tickFormatter={formatK}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "var(--color-text-tertiary)" }}
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={12}
              interval={3}
              tick={{ fontSize: 13, fill: "var(--color-text-tertiary)" }}
            />
            <Tooltip
              content={() => null}
              cursor={{ stroke: "var(--color-chart-cursor)", strokeWidth: 1, strokeDasharray: "4 4" }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="none"
              fill={`url(#${gradientId})`}
              isAnimationActive
              animationDuration={450}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--color-chart-2-active)"
              strokeWidth={2.5}
              dot={false}
              activeDot={<ActiveDot />}
              isAnimationActive
              animationDuration={450}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
