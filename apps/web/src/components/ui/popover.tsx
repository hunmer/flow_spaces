"use client";

import * as React from "react";
import {
  Button as AriaButton,
  Dialog as AriaDialog,
  Heading as AriaHeading,
  Popover as AriaPopover,
  Text as AriaText,
} from "react-aria-components";
import { cx } from "@/utils/cx";
import {
  PopoverTrigger as BoardPopoverTrigger,
  usePopoverPortalRef,
} from "@/components/base/popover/popover";

/**
 * BoardUI (React Aria Components) 后端的 Popover 复合 API。
 * 保持原 Base UI 版本的导出名与 props 形态：
 * - <Popover open onOpenChange>{Trigger}{Content}</Popover>
 * - <PopoverTrigger render={<Button/>} className>children</PopoverTrigger>
 * - <PopoverContent side align sideOffset alignOffset tooltipStyle className>
 * 外部 dismiss 采用 BoardUI 的 useDismissOnOutsidePress 方案
 * （isNonModal 避免 react-aria 模态滚动锁拖动页面滚动位置）。
 */

function toAriaPlacement(side: string, align: string): string {
  const a = align === "start" ? "start" : align === "end" ? "end" : "center";
  if (side === "left" || side === "right") {
    if (a === "start") return `${side} top`;
    if (a === "end") return `${side} bottom`;
    return side;
  }
  if (a === "start") return `${side} left`;
  if (a === "end") return `${side} right`;
  return side;
}

const PopoverCloseCtx = React.createContext<{ close: () => void }>({
  close: () => {},
});

export function Popover({
  open,
  onOpenChange,
  defaultOpen,
  children,
  ...props
}: {
  open?: boolean;
  onOpenChange?: (open: boolean, ...rest: unknown[]) => void;
  defaultOpen?: boolean;
  children?: React.ReactNode;
  [key: string]: unknown;
}): React.ReactElement {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false);
  const isOpen = open ?? uncontrolledOpen;
  const close = React.useCallback(() => {
    setUncontrolledOpen(false);
    onOpenChange?.(false);
  }, [onOpenChange]);

  return (
    <PopoverCloseCtx value={{ close }}>
      <BoardPopoverTrigger
        isOpen={isOpen}
        defaultOpen={defaultOpen}
        onOpenChange={(next) => {
          setUncontrolledOpen(next);
          onOpenChange?.(next);
        }}
        {...props}
      >
        {children}
      </BoardPopoverTrigger>
    </PopoverCloseCtx>
  );
}

export function PopoverTrigger({
  render,
  children,
  className,
  nativeButton: _nativeButton,
  ...props
}: {
  render?: React.ReactElement;
  children?: React.ReactNode;
  className?: string;
  /** Base UI 遗留开关：RAC 后端始终由 react-aria 渲染按钮语义，剥离不透传。 */
  nativeButton?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  [key: string]: unknown;
}): React.ReactElement {
  // BoardPopoverTrigger 统一通过 Pressable 注入交互和 ref。
  // 将 props 透传到最终按钮，避免再嵌套 Pressable 造成重复处理。
  const element = render ?? <button type="button" />;
  const own = element.props as { className?: string; children?: React.ReactNode };
  return React.cloneElement(element, {
    ...props,
    className: cx(className, own.className),
    children: children ?? own.children,
  } as Record<string, unknown>);
}

export function PopoverPopup({
  children,
  className,
  side = "bottom",
  align = "center",
  sideOffset = 4,
  alignOffset,
  tooltipStyle = false,
  hideArrow,
  portalProps,
  anchor,
  ...props
}: {
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  alignOffset?: number;
  tooltipStyle?: boolean;
  hideArrow?: boolean;
  portalProps?: Record<string, unknown>;
  anchor?: unknown;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  [key: string]: unknown;
}): React.ReactElement {
  const portalRef = usePopoverPortalRef();
  void hideArrow;
  void portalProps;
  void anchor;
  return (
    <AriaPopover
      ref={portalRef}
      isNonModal
      placement={toAriaPlacement(side, align) as never}
      offset={sideOffset}
      crossOffset={alignOffset}
      className={cx(
        tooltipStyle
          ? "z-110 rounded-lg border border-border-button-default bg-background-primary-default text-text-primary shadow-dropdown"
          : "z-110 rounded-[20px] border border-border-button-default bg-background-primary-default p-1.5 text-text-primary shadow-dropdown transition-opacity duration-150 data-[entering]:opacity-0 data-[exiting]:opacity-0",
        className,
      )}
      data-slot="popover-popup"
      {...props}
    >
      <AriaDialog
        className={cx(
          "flex flex-col outline-none",
          tooltipStyle ? "px-2 py-1 text-xs" : "p-2",
        )}
      >
        {children}
      </AriaDialog>
    </AriaPopover>
  );
}

export function PopoverClose({
  children,
  ...props
}: {
  children?: React.ReactNode;
  [key: string]: unknown;
}): React.ReactElement {
  const { close } = React.useContext(PopoverCloseCtx);
  return (
    <AriaButton onPress={() => close()} data-slot="popover-close" {...props}>
      {children}
    </AriaButton>
  );
}

export function PopoverTitle({
  className,
  ...props
}: {
  className?: string;
  [key: string]: unknown;
}): React.ReactElement {
  return (
    <AriaHeading
      slot="title"
      className={cx("text-title-3-semibold text-text-primary", className)}
      data-slot="popover-title"
      {...props}
    />
  );
}

export function PopoverDescription({
  className,
  ...props
}: {
  className?: string;
  [key: string]: unknown;
}): React.ReactElement {
  return (
    <AriaText
      slot="description"
      className={cx("text-body-regular text-text-secondary", className)}
      data-slot="popover-description"
      {...props}
    />
  );
}

/** 兼容占位：旧 Base UI createHandle 无消费方。 */
export const PopoverCreateHandle: () => { open: () => void; close: () => void } =
  () => ({ open: () => {}, close: () => {} });

/** 兼容再导出：旧 Base UI Primitive 命名空间（本文件外部无消费方）。 */
const PopoverPrimitive = {
  Root: Popover,
  Trigger: PopoverTrigger,
  Popup: PopoverPopup,
  Close: PopoverClose,
  Title: PopoverTitle,
  Description: PopoverDescription,
} as const;

export { PopoverPrimitive, PopoverPopup as PopoverContent };
