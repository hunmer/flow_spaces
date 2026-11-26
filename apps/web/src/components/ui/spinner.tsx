import type { LucideIcon } from "lucide-react";
import type React from "react";
import { Spinner as BoardSpinner, type SpinnerSize } from "@/components/base/spinner/spinner";
import { cx } from "@/utils/cx";

/**
 * Migrated to the BoardUI spinner (react-aria-components ProgressBar backend).
 * Keeps the old lucide prop surface (`React.ComponentProps<LucideIcon>`) so
 * consumers need no changes: BoardUI size tokens ("xs"…"xl") pass straight
 * through; a numeric lucide `size` maps to the nearest BoardUI size.
 */
const SIZES: SpinnerSize[] = ["xs", "sm", "md", "lg", "xl"];

function toBoardSize(size: string | number | undefined): SpinnerSize {
  if (typeof size === "string" && (SIZES as string[]).includes(size)) {
    return size as SpinnerSize;
  }
  const px = typeof size === "string" ? Number(size) : size;
  if (px == null || !Number.isFinite(px)) return "md";
  if (px <= 14) return "xs";
  if (px <= 18) return "sm";
  if (px <= 24) return "md";
  if (px <= 30) return "lg";
  return "xl";
}

export function Spinner({
  className,
  size,
  ...props
}: React.ComponentProps<LucideIcon>): React.ReactElement {
  const ariaHidden = props["aria-hidden"];
  return (
    <BoardSpinner
      size={toBoardSize(size)}
      className={cx(className)}
      aria-label={props["aria-label"] ?? "Loading"}
      aria-hidden={ariaHidden === true || ariaHidden === "true" ? true : undefined}
    />
  );
}
