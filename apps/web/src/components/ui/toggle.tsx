"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { useState } from "react";
import type { ComponentProps, ReactElement } from "react";
import { cx } from "@/utils/cx";

export const toggleVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-2lg border font-medium text-base text-text-primary outline-none transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-2lg)-1px)] pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background-primary-default disabled:pointer-events-none disabled:opacity-64 data-pressed:bg-background-secondary-default data-pressed:text-text-primary sm:text-sm [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg]:shrink-0",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: "h-9 min-w-9 px-[calc(--spacing(2)-1px)] sm:h-8 sm:min-w-8",
        lg: "h-10 min-w-10 px-[calc(--spacing(2.5)-1px)] sm:h-9 sm:min-w-9",
        sm: "h-8 min-w-8 px-[calc(--spacing(1.5)-1px)] sm:h-7 sm:min-w-7",
      },
      variant: {
        default: "border-transparent",
        outline:
          "border-border-button-default bg-background-primary-default not-dark:bg-clip-padding shadow-xs/5 not-disabled:not-active:not-data-pressed:before:shadow-[0_1px_--theme(--color-black/4%)] dark:bg-input/32 dark:data-pressed:bg-input dark:hover:bg-input/64 dark:not-disabled:not-active:not-data-pressed:before:shadow-[0_-1px_--theme(--color-white/6%)] dark:not-disabled:not-data-pressed:before:shadow-[0_-1px_--theme(--color-white/2%)] [:disabled,:active,[data-pressed]]:shadow-none",
      },
    },
  },
);

export interface ToggleProps
  extends Omit<ComponentProps<"button">, "onPressedChange">,
    VariantProps<typeof toggleVariants> {
  /** Controlled pressed state. */
  pressed?: boolean;
  /** Initial pressed state for the uncontrolled case. */
  defaultPressed?: boolean;
  /** Fired with the next pressed state whenever the toggle is activated. */
  onPressedChange?: (pressed: boolean) => void;
}

export function Toggle({
  className,
  variant,
  size,
  pressed,
  defaultPressed = false,
  onPressedChange,
  onClick,
  type = "button",
  ...props
}: ToggleProps): ReactElement {
  const [internalPressed, setInternalPressed] = useState(defaultPressed);
  const isPressed = pressed ?? internalPressed;

  return (
    <button
      aria-pressed={isPressed}
      className={cx(toggleVariants({ className, size, variant }))}
      data-pressed={isPressed || undefined}
      data-slot="toggle"
      type={type}
      onClick={(event) => {
        const next = !isPressed;
        if (pressed === undefined) setInternalPressed(next);
        onPressedChange?.(next);
        onClick?.(event);
      }}
      {...props}
    />
  );
}
