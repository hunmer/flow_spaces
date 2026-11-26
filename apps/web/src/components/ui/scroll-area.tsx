"use client"

import * as React from "react"

import { cx } from "@/utils/cx"

/**
 * ScrollArea — local implementation replacing the Base UI scroll area.
 * The viewport is a native overflow-auto container; ScrollBar renders a
 * static styled track + thumb so existing `data-orientation` class hooks
 * keep working. Export surface unchanged: ScrollArea / ScrollBar.
 *
 * Legacy coss props (overscrollContain / scrollFade / scrollbarGutter) are
 * accepted for drop-in compatibility with former coss/scroll-area callers:
 * overscrollContain adds `overscroll-contain` on the viewport; the other two
 * were no-ops in the coss version and stay no-ops here.
 */

interface ScrollAreaProps extends React.ComponentProps<"div"> {
  viewportClassName?: string
  overscrollContain?: boolean
  scrollFade?: boolean
  scrollbarGutter?: boolean
}

function ScrollArea({
  className,
  viewportClassName,
  overscrollContain = false,
  scrollFade: _scrollFade,
  scrollbarGutter: _scrollbarGutter,
  children,
  ...props
}: ScrollAreaProps) {
  return (
    <div
      data-slot="scroll-area"
      className={cx("relative overflow-hidden", className)}
      {...props}
    >
      <div
        data-slot="scroll-area-viewport"
        className={cx(
          "size-full overflow-auto rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1",
          overscrollContain && "overscroll-contain",
          viewportClassName
        )}
      >
        {children}
      </div>
    </div>
  )
}

interface ScrollBarProps extends React.ComponentProps<"div"> {
  orientation?: "horizontal" | "vertical"
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: ScrollBarProps) {
  return (
    <div
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      aria-hidden="true"
      className={cx(
        "flex touch-none p-px transition-colors select-none data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:h-full data-vertical:w-2.5 data-vertical:border-l data-vertical:border-l-transparent",
        className
      )}
      {...props}
    >
      <div
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border"
      />
    </div>
  )
}

export { ScrollArea, ScrollBar }
