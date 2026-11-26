import type * as React from "react";
import { Kbd as BoardKbd } from "@/components/base/kbd/kbd";
import { cx } from "@/utils/cx";

/**
 * Kbd migrated to BoardUI: renders the base primitive from
 * @/components/base/kbd/kbd (semantic kbd-background/kbd-foreground tokens,
 * fully-rounded neutral pill) while keeping the original export surface
 * (Kbd / KbdGroup with `<kbd>` element props) so consumers need no changes.
 */
export function Kbd({
  className,
  ...props
}: React.ComponentProps<"kbd">): React.ReactElement {
  return (
    <BoardKbd
      className={cx(
        "pointer-events-none inline-flex min-w-5 select-none items-center justify-center gap-1",
        className,
      )}
      {...props}
    />
  );
}

export function KbdGroup({
  className,
  ...props
}: React.ComponentProps<"kbd">): React.ReactElement {
  return (
    <BoardKbd
      className={cx("inline-flex items-center justify-center gap-1", className)}
      {...props}
    />
  );
}
