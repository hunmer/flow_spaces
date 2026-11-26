"use client";

import type { VariantProps } from "class-variance-authority";
import * as React from "react";
import { cx } from "@/utils/cx";
// BoardUI 迁移：ui/separator 移除；base Divider 仅支持水平线，组内默认竖线改为自绘语义 token 分隔线
import { Toggle, type toggleVariants } from "@/components/ui/toggle";

interface ToggleGroupContextValue extends VariantProps<typeof toggleVariants> {
  isSelected: (value: string) => boolean;
  toggleValue: (value: string, next: boolean) => void;
  disabled: boolean;
}

const ToggleGroupContext = React.createContext<ToggleGroupContextValue>({
  size: "default",
  variant: "default",
  isSelected: () => false,
  toggleValue: () => undefined,
  disabled: false,
});

export interface ToggleGroupProps
  extends Omit<React.ComponentProps<"div">, "onChange" | "defaultValue">,
    VariantProps<typeof toggleVariants> {
  /** Controlled selected values (multi-select by default). */
  value?: string[];
  /** Initial selected values for the uncontrolled case. */
  defaultValue?: string[];
  /** Fired with the full next selection whenever an item toggles. */
  onValueChange?: (value: string[]) => void;
  orientation?: "horizontal" | "vertical";
  /** Disable the whole group. */
  disabled?: boolean;
}

export function ToggleGroup({
  className,
  variant = "default",
  size = "default",
  orientation = "horizontal",
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  children,
  ...props
}: ToggleGroupProps): React.ReactElement {
  const [internalValue, setInternalValue] = React.useState<string[]>(
    defaultValue ?? [],
  );
  const selected = value ?? internalValue;

  const isSelected = React.useCallback(
    (itemValue: string) => selected.includes(itemValue),
    [selected],
  );

  const toggleValue = React.useCallback(
    (itemValue: string, next: boolean) => {
      const nextValue = next
        ? [...selected, itemValue]
        : selected.filter((v) => v !== itemValue);
      if (value === undefined) setInternalValue(nextValue);
      onValueChange?.(nextValue);
    },
    [selected, value, onValueChange],
  );

  return (
    <div
      className={cx(
        "flex w-fit *:focus-visible:z-10 dark:*:[[data-slot=separator]:has(+[data-slot=toggle]:hover)]:before:bg-input/64 dark:*:[[data-slot=separator]:has(+[data-slot=toggle][data-pressed])]:before:bg-input dark:*:[[data-slot=toggle]:hover+[data-slot=separator]]:before:bg-input/64 dark:*:[[data-slot=toggle][data-pressed]+[data-slot=separator]]:before:bg-input",
        orientation === "horizontal"
          ? "*:pointer-coarse:after:min-w-auto"
          : "*:pointer-coarse:after:min-h-auto",
        variant === "default"
          ? "gap-0.5"
          : orientation === "horizontal"
            ? "*:not-first:rounded-s-none *:not-last:rounded-e-none *:not-first:border-s-0 *:not-last:border-e-0 *:not-first:not-data-[slot=separator]:before:-start-[0.5px] *:not-last:not-data-[slot=separator]:before:-end-[0.5px] *:not-first:before:rounded-s-none *:not-last:before:rounded-e-none"
            : "flex-col *:not-first:rounded-t-none *:not-last:rounded-b-none *:not-first:border-t-0 *:not-last:border-b-0 *:not-first:not-data-[slot=separator]:before:-top-[0.5px] *:not-last:not-data-[slot=separator]:before:-bottom-[0.5px] *:not-first:before:rounded-t-none *:not-last:before:rounded-b-none *:data-[slot=toggle]:not-last:before:hidden dark:*:last:before:hidden dark:*:first:before:block",
        className,
      )}
      data-orientation={orientation}
      data-disabled={disabled || undefined}
      data-size={size}
      data-slot="toggle-group"
      data-variant={variant}
      role="group"
      {...props}
    >
      <ToggleGroupContext.Provider
        value={{ size, variant, isSelected, toggleValue, disabled }}
      >
        {children}
      </ToggleGroupContext.Provider>
    </div>
  );
}

export interface ToggleGroupItemProps
  extends Omit<
    React.ComponentProps<typeof Toggle>,
    "pressed" | "onPressedChange" | "size" | "variant" | "value"
  >,
    VariantProps<typeof toggleVariants> {
  /** Item value tracked by the group selection. */
  value: string;
}

export function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  value,
  disabled,
  ...props
}: ToggleGroupItemProps): React.ReactElement {
  const context = React.useContext(ToggleGroupContext);

  const resolvedVariant = context.variant || variant;
  const resolvedSize = context.size || size;

  return (
    <Toggle
      className={className}
      data-size={resolvedSize}
      data-variant={resolvedVariant}
      disabled={disabled || context.disabled}
      onPressedChange={(next) => context.toggleValue(value, next)}
      pressed={context.isSelected(value)}
      size={resolvedSize}
      variant={resolvedVariant}
      {...props}
    >
      {children}
    </Toggle>
  );
}

export function ToggleGroupSeparator({
  className,
  orientation = "vertical",
  ...props
}: {
  className?: string;
} & React.ComponentProps<"div"> & {
    orientation?: "horizontal" | "vertical";
  }): React.ReactElement {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cx(
        "pointer-events-none relative shrink-0 bg-separator-border",
        orientation === "vertical" ? "w-px self-stretch" : "h-px w-full",
        className,
      )}
      {...props}
    />
  );
}
