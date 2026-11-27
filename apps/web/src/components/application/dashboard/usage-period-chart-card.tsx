"use client";

import { useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { useCountUp } from "@/hooks/use-count-up";
import type { UsagePoint } from "@/hooks/use-invocation-stats";
import { cx } from "@/utils/cx";

/**
 * Usage Period Chart Card: invocation counts as bars for either this week
 * (one bar per day) or this year (one bar per month), switched by the
 * segmented control in the header. The header matches the trend chart card:
 * a count-up total that swaps to the hovered bar's count. Without data it
 * shows the demo series (component gallery); dashboards pass the aggregated
 * weekly / monthly points from useInvocationStats.
 */

export type { UsagePoint };

export type UsagePeriod = "week" | "year";

const DAYS_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Demo series for the component gallery. */
export const USAGE_WEEK_DATA: UsagePoint[] = [
  { label: "Mon", value: 412 },
  { label: "Tue", value: 386 },
  { label: "Wed", value: 441 },
  { label: "Thu", value: 397 },
  { label: "Fri", value: 458 },
  { label: "Sat", value: 214 },
  { label: "Sun", value: 176 },
];

export const USAGE_MONTH_DATA: UsagePoint[] = [
  { label: "Jan", value: 1284 },
  { label: "Feb", value: 1192 },
  { label: "Mar", value: 1376 },
  { label: "Apr", value: 1408 },
  { label: "May", value: 1522 },
  { label: "Jun", value: 1610 },
  { label: "Jul", value: 1584 },
  { label: "Aug", value: 1472 },
  { label: "Sep", value: 1601 },
  { label: "Oct", value: 1688 },
  { label: "Nov", value: 1540 },
  { label: "Dec", value: 1726 },
];

const formatK = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k` : `${value}`;

export function UsagePeriodChartCard({
  weekly = USAGE_WEEK_DATA,
  monthly = USAGE_MONTH_DATA,
  title = "Invocations",
  className,
}: {
  /** One point per day, Monday first; defaults to the demo week. */
  weekly?: UsagePoint[];
  /** One point per month, January first; defaults to the demo year. */
  monthly?: UsagePoint[];
  /** Headline label when no bar is hovered. */
  title?: string;
  className?: string;
} = {}) {
  const [period, setPeriod] = useState<UsagePeriod>("week");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const data = period === "week" ? weekly : monthly;
  const captions = { week: "This week", year: "This year" } as const;
  const captionsFull = period === "week" ? DAYS_FULL : MONTHS_FULL;

  const total = data.reduce((sum, point) => sum + point.value, 0);
  const hovering = activeIndex !== null && activeIndex < data.length;
  const point = hovering ? data[activeIndex] : null;

  const headlineValue = point ? point.value : total;
  const label =
    point && activeIndex !== null && activeIndex < captionsFull.length
      ? captionsFull[activeIndex]
      : point
        ? point.label
        : title;
  const display = useCountUp(headlineValue);

  const yMax = Math.max(1, ...data.map((d) => d.value));

  return (
    <section
      className={cx(
        "flex h-[344px] min-w-0 flex-1 flex-col gap-6 rounded-2xl bg-background-secondary-default px-4 pt-4 pb-3",
        className,
      )}
    >
      {/* Header: label over the count-up figure; period switch on the right */}
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="w-full text-body-medium text-text-secondary">{label}</p>
          <p
            key={`${period}/${activeIndex ?? "total"}`}
            className="animate-number-fade text-title-1-medium whitespace-nowrap text-text-primary tabular-nums"
          >
            {display.toLocaleString("en-US")}
          </p>
          <p className="text-body-2-medium text-text-tertiary tabular-nums">
            {point ? `Total ${total.toLocaleString("en-US")}` : captions[period]}
          </p>
        </div>
        <SegmentedControl
          aria-label="Usage period"
          className="shrink-0"
          selectedKeys={[period]}
          onSelectionChange={(keys) => {
            const [key] = keys;
            if (key !== undefined) {
              setPeriod(String(key) as UsagePeriod);
              setActiveIndex(null);
            }
          }}
        >
          <SegmentedControlItem id="week">This week</SegmentedControlItem>
          <SegmentedControlItem id="year">This year</SegmentedControlItem>
        </SegmentedControl>
      </div>

      {/* Chart */}
      <div className="min-h-0 w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 4, right: 6, bottom: 0, left: 0 }}
            barCategoryGap="28%"
            onMouseMove={(state) => {
              const index = Number(state?.activeTooltipIndex);
              if (state?.isTooltipActive && Number.isFinite(index)) setActiveIndex(index);
            }}
            onMouseLeave={() => setActiveIndex(null)}
          >
            <YAxis
              width={40}
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
              interval="preserveStartEnd"
              tick={{ fontSize: 13, fill: "var(--color-text-tertiary)" }}
            />
            <Tooltip content={() => null} cursor={{ fill: "var(--color-chart-track)", opacity: 0.5 }} />
            <Bar
              dataKey="value"
              fill="var(--color-chart-9-active)"
              radius={[4, 4, 0, 0]}
              isAnimationActive
              animationDuration={450}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
