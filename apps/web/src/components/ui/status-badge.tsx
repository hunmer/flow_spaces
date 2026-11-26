"use client"

import type { ComponentProps, HTMLAttributes } from "react"
import { Chip, type ChipColor } from "@/components/base/badges/chip"
import { cx } from "@/utils/cx"

/**
 * Migrated to BoardUI: `Status` now renders the BoardUI Chip primitive with
 * semantic status colour pairs. `StatusIndicator` (pulsing dot) and
 * `StatusLabel` keep their unique visuals, restyled onto BoardUI semantic
 * tokens. Export surface (Status / StatusIndicator / StatusLabel) is unchanged.
 */
const STATUS_CHIP: Record<"online" | "offline" | "maintenance" | "degraded", ChipColor> = {
  online: "lime",
  offline: "rose",
  maintenance: "blue",
  degraded: "yellow",
}

export type StatusProps = ComponentProps<typeof Chip> & {
  status: "online" | "offline" | "maintenance" | "degraded"
}

export const Status = ({ className, status, ...props }: StatusProps) => (
  <Chip
    className={cx("group gap-2", status, className)}
    color={STATUS_CHIP[status]}
    variant="bold"
    {...props}
  />
)

/** Pulsing status dot — unique visual, colours moved to BoardUI semantic tokens. */
export const StatusIndicator = ({ className, ...props }: HTMLAttributes<HTMLSpanElement>) => (
  <span className={cx("relative flex h-2 w-2", className)} {...props}>
    <span
      className={cx(
        "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 bg-current",
        "group-[.online]:text-status-lime-text",
        "group-[.offline]:text-notification-error-foreground",
        "group-[.maintenance]:text-status-blue-text",
        "group-[.degraded]:text-status-yellow-text",
      )}
    />
    <span
      className={cx(
        "relative inline-flex h-2 w-2 rounded-full bg-current",
        "group-[.online]:text-status-lime-text",
        "group-[.offline]:text-notification-error-foreground",
        "group-[.maintenance]:text-status-blue-text",
        "group-[.degraded]:text-status-yellow-text",
      )}
    />
  </span>
)

export const StatusLabel = ({ className, children, ...props }: HTMLAttributes<HTMLSpanElement>) => (
  <span className={cx("text-text-secondary", className)} {...props}>
    {children ?? (
      <>
        <span className="hidden group-[.online]:block">Online</span>
        <span className="hidden group-[.offline]:block">Offline</span>
        <span className="hidden group-[.maintenance]:block">Maintenance</span>
        <span className="hidden group-[.degraded]:block">Degraded</span>
      </>
    )}
  </span>
)
