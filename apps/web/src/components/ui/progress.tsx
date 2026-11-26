"use client";

import { createContext, useContext } from "react";
import type React from "react";
import { ProgressBar as AriaProgressBar } from "react-aria-components";
import { cx } from "@/utils/cx";

/**
 * Progress migrated off Base UI progress onto the React Aria
 * ProgressBar (BoardUI backend). The composite API is kept: Progress /
 * ProgressLabel / ProgressTrack / ProgressIndicator / ProgressValue, with the
 * value shared through context so <ProgressTrack><ProgressIndicator/></ProgressTrack>
 * still works without explicit props.
 */

interface ProgressContextValue {
  value: number;
  percentage: number;
}

const ProgressContext = createContext<ProgressContextValue>({
  value: 0,
  percentage: 0,
});

export type ProgressProps = Omit<
  React.ComponentProps<typeof AriaProgressBar>,
  "children" | "className"
> & {
  className?: string;
  children?: React.ReactNode;
};

export function Progress({
  className,
  value = 0,
  minValue = 0,
  maxValue = 100,
  children,
  ...props
}: ProgressProps): React.ReactElement {
  const span = maxValue - minValue;
  const percentage = span > 0
    ? Math.min(100, Math.max(0, ((value - minValue) / span) * 100))
    : 0;

  return (
    <AriaProgressBar
      value={value}
      minValue={minValue}
      maxValue={maxValue}
      className={cx("flex w-full flex-col gap-2", className)}
      data-slot="progress"
      {...props}
    >
      <ProgressContext.Provider value={{ value, percentage }}>
        {children ? (
          children
        ) : (
          <ProgressTrack>
            <ProgressIndicator />
          </ProgressTrack>
        )}
      </ProgressContext.Provider>
    </AriaProgressBar>
  );
}

export function ProgressLabel({
  className,
  ...props
}: React.ComponentProps<"span">): React.ReactElement {
  return (
    <span className={cx("font-medium text-sm", className)} data-slot="progress-label" {...props} />
  );
}

export function ProgressTrack({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cx(
        "block h-1.5 w-full overflow-hidden rounded-full bg-border-button-default text-accent-500",
        className,
      )}
      data-slot="progress-track"
      {...props}
    />
  );
}

export function ProgressIndicator({
  className,
  style,
  ...props
}: React.ComponentProps<"span">): React.ReactElement {
  const { percentage } = useContext(ProgressContext);
  return (
    <span
      className={cx("block h-full rounded-full bg-current transition-all duration-500", className)}
      style={{ width: `${percentage}%`, ...style }}
      data-slot="progress-indicator"
      {...props}
    />
  );
}

export function ProgressValue({
  className,
  ...props
}: React.ComponentProps<"span">): React.ReactElement {
  const { percentage } = useContext(ProgressContext);
  return (
    <span className={cx("text-sm tabular-nums", className)} data-slot="progress-value" {...props}>
      {`${Math.round(percentage)}%`}
    </span>
  );
}

// BoardUI Meter (react-aria-components Meter backend) — re-exported so new
// code can use the migrated primitive without importing from base directly.
export { Meter } from "@/components/base/meter/meter";
