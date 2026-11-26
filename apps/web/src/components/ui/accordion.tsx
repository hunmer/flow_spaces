"use client";

import type React from "react";
import {
  Button as AriaButton,
  Disclosure as AriaDisclosure,
  DisclosureGroup as AriaDisclosureGroup,
  DisclosurePanel as AriaDisclosurePanel,
  Heading as AriaHeading,
} from "react-aria-components";
import type {
  DisclosureGroupProps as AriaDisclosureGroupProps,
  DisclosureProps as AriaDisclosureProps,
} from "react-aria-components";
import { ChevronDownIcon } from "lucide-react";
import { cx } from "@/utils/cx";

/**
 * Accordion migrated to BoardUI: React Aria Components DisclosureGroup /
 * Disclosure backend (same primitives as @/components/base/accordion).
 * Export surface kept: Accordion / AccordionItem / AccordionTrigger /
 * AccordionPanel (+ AccordionContent alias). `multiple` / `openMultiple` are
 * Base UI compat aliases for `allowsMultipleExpansions`.
 */

export type AccordionProps = Omit<
  AriaDisclosureGroupProps,
  "className" | "children"
> & {
  multiple?: boolean;
  openMultiple?: boolean;
  className?: string;
  children?: React.ReactNode;
};

export function Accordion({
  className,
  multiple,
  openMultiple,
  allowsMultipleExpanded,
  ...props
}: AccordionProps): React.ReactElement {
  return (
    <AriaDisclosureGroup
      data-slot="accordion"
      allowsMultipleExpanded={
        allowsMultipleExpanded ?? multiple ?? openMultiple ?? false
      }
      className={className}
      {...props}
    />
  );
}

export type AccordionItemProps = Omit<AriaDisclosureProps, "className" | "children"> & {
  /** Base UI compat alias for React Aria's `id`. */
  value?: string | number;
  className?: string;
  children?: React.ReactNode;
};

export function AccordionItem({
  className,
  value,
  ...props
}: AccordionItemProps): React.ReactElement {
  return (
    <AriaDisclosure
      id={value}
      className={cx("border-b last:border-b-0", className)}
      data-slot="accordion-item"
      {...props}
    />
  );
}

export function AccordionTrigger({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"button">, "ref" | "value" | "onClick">): React.ReactElement {
  // RAC Button 的 onClick 事件目标是 FocusableElement 而非 HTMLButtonElement，
  // 原生 button props 直接交叉会类型不兼容；消费方透传 props 走运行时展开。
  const ariaProps = props as unknown as React.ComponentProps<typeof AriaButton>;
  return (
    <AriaHeading className="flex">
      <AriaButton
        slot="trigger"
        className={cx(
          "group/acc-trigger flex flex-1 cursor-pointer items-start justify-between gap-4 rounded-md py-4 text-left font-medium text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-border-focus-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-64",
          className,
        )}
        data-slot="accordion-trigger"
        {...ariaProps}
      >
        {children}
        <ChevronDownIcon
          className="pointer-events-none size-4 shrink-0 translate-y-0.5 opacity-80 transition-transform duration-200 ease-in-out group-data-[expanded]/acc-trigger:rotate-180"
          data-slot="accordion-indicator"
        />
      </AriaButton>
    </AriaHeading>
  );
}

export function AccordionPanel({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof AriaDisclosurePanel>, "className" | "children"> & {
  className?: string;
  children?: React.ReactNode;
}): React.ReactElement {
  return (
    <AriaDisclosurePanel
      className="h-(--disclosure-panel-height) overflow-hidden text-text-secondary text-sm transition-[height] duration-200 ease-in-out motion-reduce:transition-none"
      data-slot="accordion-panel"
      {...props}
    >
      <div className={cx("pt-0 pb-4", className)}>{children}</div>
    </AriaDisclosurePanel>
  );
}

export { AccordionPanel as AccordionContent };
