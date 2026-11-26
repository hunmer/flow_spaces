"use client";

import { cva, type VariantProps } from "class-variance-authority";
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
  type ReactElement,
} from "react";
import {
  Button as AriaButton,
  Header as AriaHeader,
  Label as AriaLabel,
  ListBox as AriaListBox,
  ListBoxItem as AriaListBoxItem,
  ListBoxSection as AriaListBoxSection,
  Popover as AriaPopover,
  Select as AriaSelect,
  Separator as AriaSeparator,
  SelectValue as AriaSelectValue,
} from "react-aria-components";
import type {
  SelectProps as AriaSelectProps,
  SelectValueRenderProps as AriaSelectValueRenderProps,
} from "react-aria-components";
import type * as React from "react";
import { cx } from "@/utils/cx";
import {
  MENU_ITEM,
  MENU_ITEM_ACTIVE,
  MENU_ITEMS_CONTAINER,
  MENU_POPOVER_SURFACE,
  MENU_POPOVER_WIDTH,
} from "@/components/base/dropdown/menu-styles";
import { ChevronDownSmall } from "@/components/foundations/icons/chevrons";
import {
  useDismissOnOutsidePress,
  useTriggerToggle,
} from "@/utils/use-dismiss-on-outside-press";

// Trigger recipe 1:1 with BoardUI base/select (Figma dashboard dropdown):
// bg-background-primary-default, border-button-default, shadow-xs,
// radius-2lg, hover bg/border, focus-visible ring.
export const selectTriggerVariants = cva(
  "flex w-full min-w-0 cursor-pointer select-none items-center justify-between rounded-2lg border border-border-button-default bg-background-primary-default text-start text-text-primary shadow-xs outline-none transition-[background-color,border-color,box-shadow,padding,font-size] duration-200 ease hover:bg-background-primary-hover hover:border-border-button-hover focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-border-focus-ring disabled:cursor-not-allowed disabled:bg-background-primary-disabled disabled:text-text-tertiary disabled:shadow-none disabled:pointer-events-none",
  {
    defaultVariants: {
      size: "default",
    },
    variants: {
      size: {
        default: "gap-1.5 px-2.5 py-2 text-body-medium",
        lg: "gap-1.5 px-3 py-2.5 text-body-medium",
        sm: "gap-1 px-[7px] py-1 text-body-2-medium",
      },
    },
  },
);

export const selectTriggerIconClassName =
  "shrink-0 text-text-secondary transition-transform duration-200 ease group-data-open:rotate-180 size-4 sm:size-3.5";

interface SelectContextValue {
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  popoverRef: React.RefObject<HTMLElement | null>;
}

const SelectContext = createContext<SelectContextValue | null>(null);

function useSelectContext(): SelectContextValue {
  const context = useContext(SelectContext);
  if (!context) {
    throw new Error(
      "Select compound parts must be rendered inside a <Select> root.",
    );
  }
  return context;
}

export interface SelectProps<T extends object = object>
  extends Omit<
    AriaSelectProps<T>,
    | "children"
    | "selectedKey"
    | "defaultSelectedKey"
    | "onSelectionChange"
    | "isDisabled"
    | "placeholder"
  > {
  /** Controlled selected value (the SelectItem `value`). */
  value?: string | null;
  /** Initial selected value for the uncontrolled case. */
  defaultValue?: string;
  /** Fired with the next selected value whenever it changes. */
  onValueChange?: (value: string) => void;
  /** Disable the whole select. */
  disabled?: boolean;
  children: ReactNode;
}

export function Select<T extends object = object>({
  value,
  defaultValue,
  onValueChange,
  disabled,
  className,
  children,
  ...props
}: SelectProps<T>): React.ReactElement {
  // The popover is `isNonModal`: react-aria's modal scroll lock puts
  // `overflow: hidden` on <html>, which collapses this app's page scroll.
  // Non-modal skips the lock but disables react-aria's outside-press
  // dismissal, so open state is controlled here and dismissal restored
  // manually (same fix as base/select and the date-picker family).
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  useDismissOnOutsidePress(isOpen, () => setIsOpen(false), [
    triggerRef,
    popoverRef,
  ]);
  // Pressing the trigger while open closes the popover instead of reopening
  const allowOpenChange = useTriggerToggle(isOpen, triggerRef);

  return (
    <AriaSelect
      {...props}
      className={
        typeof className === "function"
          ? className
          : cx("group flex flex-col", className)
      }
      defaultSelectedKey={defaultValue}
      isDisabled={disabled}
      isOpen={isOpen}
      onOpenChange={(open) => allowOpenChange(open) && setIsOpen(open)}
      onSelectionChange={(key) => onValueChange?.(String(key))}
      selectedKey={value ?? null}
    >
      <SelectContext.Provider value={{ triggerRef, popoverRef }}>
        {children}
      </SelectContext.Provider>
    </AriaSelect>
  );
}

export interface SelectTriggerProps
  extends React.ComponentProps<typeof AriaButton>,
    VariantProps<typeof selectTriggerVariants> {}

export function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectTriggerProps): React.ReactElement {
  const { triggerRef } = useSelectContext();
  return (
    <AriaButton
      ref={triggerRef}
      className={
        typeof className === "function"
          ? className
          : cx(selectTriggerVariants({ size }), className)
      }
      data-slot="select-trigger"
      {...props}
    >
      {/* RAC Button children may be a render function; our API only passes nodes. */}
      {children as ReactNode}
      <ChevronDownSmall className={selectTriggerIconClassName} />
    </AriaButton>
  );
}

interface SelectValueRenderFallbackProps {
  selectedText?: ReactNode;
  isPlaceholder?: boolean;
  defaultRender?: () => ReactNode;
}

export interface SelectValueProps {
  className?: string;
  /** Shown while nothing is selected. */
  placeholder?: string;
  /** Custom rendering of the selected value; falls back to the item's text. */
  children?: ReactNode;
}

export function SelectValue({
  className,
  placeholder,
  children,
  ...props
}: SelectValueProps): React.ReactElement {
  const renderFallback = (
    values: SelectValueRenderFallbackProps,
  ): ReactNode =>
    values.isPlaceholder || values.selectedText == null
      ? placeholder != null
        ? <span className="text-text-placeholder">{placeholder}</span>
        : null
      : (values.defaultRender?.() ?? values.selectedText);

  return (
    <AriaSelectValue
      className={cx(
        "flex min-w-0 flex-1 items-center truncate data-placeholder:text-text-placeholder",
        className,
      )}
      data-slot="select-value"
      {...props}
    >
      {children ??
        (renderFallback as unknown as (
          values: AriaSelectValueRenderProps<unknown>,
        ) => ReactNode)}
    </AriaSelectValue>
  );
}

export interface SelectPopupProps {
  className?: string;
  /** Preferred side of the trigger; the popover flips when it overflows. */
  side?: "top" | "bottom";
  /** Distance from the trigger in px. */
  sideOffset?: number;
  children: ReactNode;
}

export function SelectPopup({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
}: SelectPopupProps): React.ReactElement {
  const { popoverRef } = useSelectContext();
  return (
    <AriaPopover
      ref={popoverRef}
      className={cx(
        MENU_POPOVER_WIDTH,
        MENU_POPOVER_SURFACE,
        // Listbox rows already space themselves 4px apart, so the surface
        // sits a touch tighter than the action-menu Dropdown (same as base/select).
        "p-2",
        className,
      )}
      data-slot="select-popup"
      isNonModal
      offset={sideOffset}
      placement={side === "top" ? "top" : "bottom"}
    >
      <AriaListBox
        className={cx(MENU_ITEMS_CONTAINER, "max-h-[240px] overflow-auto")}
        data-slot="select-list"
      >
        {children}
      </AriaListBox>
    </AriaPopover>
  );
}

export interface SelectItemProps {
  /** Static classes, or a function of the item state (focused/selected/disabled). */
  className?: string | ((state: {
    isFocused: boolean;
    isSelected: boolean;
    isDisabled: boolean;
  }) => string);
  /** Item value — becomes the selection key. */
  value: string;
  disabled?: boolean;
  children?: ReactNode;
}

export function SelectItem({
  className,
  value,
  disabled,
  children,
  ...props
}: SelectItemProps): React.ReactElement {
  return (
    <AriaListBoxItem
      className={(state) =>
        cx(
          MENU_ITEM,
          "text-body-medium",
          (state.isFocused || state.isSelected) && MENU_ITEM_ACTIVE,
          state.isDisabled && "cursor-not-allowed text-text-disabled",
          typeof className === "function" ? className(state) : className,
        )
      }
      data-slot="select-item"
      id={value}
      isDisabled={disabled}
      {...props}
    >
      {children}
    </AriaListBoxItem>
  );
}

export function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof AriaSeparator>): React.ReactElement {
  return (
    <AriaSeparator
      className={cx("mx-2 my-1 h-px bg-separator-border", className)}
      data-slot="select-separator"
      {...props}
    />
  );
}

export function SelectGroup({
  className,
  ...props
}: React.ComponentProps<typeof AriaListBoxSection>): React.ReactElement {
  return (
    <AriaListBoxSection
      className={className}
      data-slot="select-group"
      {...props}
    />
  );
}

export function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof AriaLabel>): React.ReactElement {
  return (
    <AriaLabel
      className={cx(
        "not-in-data-[slot=field]:mb-2 inline-flex cursor-default items-center gap-2 font-medium text-base/4.5 text-text-primary sm:text-sm/4",
        className,
      )}
      data-slot="select-label"
      {...props}
    />
  );
}

export function SelectGroupLabel({
  className,
  ...props
}: React.ComponentProps<typeof AriaHeader>): React.ReactElement {
  return (
    <AriaHeader
      className={cx(
        "px-2 py-1.5 font-medium text-text-secondary text-xs",
        className,
      )}
      data-slot="select-group-label"
      {...props}
    />
  );
}

export { SelectPopup as SelectContent };
