"use client";

// Mini App 运行时兼容层：存量 Mini App 经 @flow-spaces/ui / window.FlowSpacesUI
// 消费 Badge/badgeVariants 的 shadcn API 表面（lib/ui-exports.ts 再导出）。
// 业务代码请改用 @/components/base/badges；此文件仅为 Mini App 平台契约保留。

import { mergeProps, useRender } from "@/components/ui/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import type React from "react";
import { cx } from "@/utils/cx";

export const badgeVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-sm border border-transparent font-medium outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-64 [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-3.5 sm:[&_svg:not([class*='size-'])]:size-3 [&_svg]:pointer-events-none [&_svg]:shrink-0 [button&,a&]:cursor-pointer [button&,a&]:pointer-coarse:after:absolute [button&,a&]:pointer-coarse:after:size-full [button&,a&]:pointer-coarse:after:min-h-11 [button&,a&]:pointer-coarse:after:min-w-11",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default:
          "h-5.5 min-w-5.5 px-[calc(--spacing(1)-1px)] text-sm sm:h-4.5 sm:min-w-4.5 sm:text-xs",
        lg: "h-6.5 min-w-6.5 px-[calc(--spacing(1.5)-1px)] text-base sm:h-5.5 sm:min-w-5.5 sm:text-sm",
        sm: "h-5 min-w-5 rounded-[.25rem] px-[calc(--spacing(1)-1px)] text-xs sm:h-4 sm:min-w-4 sm:text-[.625rem]",
      },
      variant: {
        default:
          "bg-primary text-primary-foreground [button&,a&]:hover:bg-primary/90",
        destructive:
          "bg-destructive text-white [button&,a&]:hover:bg-destructive/90",
        error:
          "bg-destructive/8 text-destructive-foreground dark:bg-destructive/16",
        info: "bg-info/8 text-info-foreground dark:bg-info/16",
        outline:
          "border-input bg-background text-foreground dark:bg-input/32 [button&,a&]:hover:bg-accent/50 dark:[button&,a&]:hover:bg-input/48",
        secondary:
          "bg-secondary text-secondary-foreground [button&,a&]:hover:bg-secondary/90",
        success: "bg-success/8 text-success-foreground dark:bg-success/16",
        warning: "bg-warning/8 text-warning-foreground dark:bg-warning/16",
      },
    },
  },
);

export interface BadgeProps extends useRender.ComponentProps<"span"> {
  variant?: VariantProps<typeof badgeVariants>["variant"];
  size?: VariantProps<typeof badgeVariants>["size"];
  /**
   * BoardUI-merged shiny variant (absorbed from shiny-badge.tsx): renders a
   * sweeping light band over the badge using the app's `animate-shine` keyframes.
   */
  shiny?: boolean;
  /** Duration of the shine sweep in seconds. Default 5. */
  shinySpeed?: number;
}

/** The shine overlay layers (light/dark variants), shared with ShinyBadge. */
export function BadgeShine({ duration }: { duration: string }) {
  return (
    <>
      <span
        className="absolute inset-0 pointer-events-none animate-shine dark:hidden"
        style={{
          background:
            "linear-gradient(120deg, transparent 40%, rgba(255,255,255,0.6) 50%, transparent 60%)",
          backgroundSize: "200% 100%",
          animationDuration: duration,
          mixBlendMode: "screen",
        }}
      />
      <span
        className="absolute inset-0 pointer-events-none animate-shine hidden dark:block"
        style={{
          background:
            "linear-gradient(120deg, transparent 40%, rgba(0,0,150,0.25) 50%, transparent 60%)",
          backgroundSize: "200% 100%",
          animationDuration: duration,
          mixBlendMode: "multiply",
        }}
      />
    </>
  );
}

export function Badge({
  className,
  variant,
  size,
  shiny = false,
  shinySpeed = 5,
  render,
  children,
  ...props
}: BadgeProps): React.ReactElement {
  const defaultProps = {
    className: cx(
      badgeVariants({ className, size, variant }),
      shiny && "relative overflow-hidden rounded-full text-xs font-semibold",
    ),
    "data-slot": "badge",
  };

  const content =
    shiny ? (
      <>
        <span className="relative z-10 inline-flex items-center">{children}</span>
        <BadgeShine duration={`${shinySpeed}s`} />
      </>
    ) : (
      children
    );

  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(defaultProps, { ...props, children: content }),
    render,
  });
}
