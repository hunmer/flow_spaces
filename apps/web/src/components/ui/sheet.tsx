"use client";

import {
  Heading as AriaHeading,
  Modal as AriaModal,
  ModalOverlay as AriaModalOverlay,
  Text as AriaText,
} from "react-aria-components";
import { XIcon } from "lucide-react";
import * as React from "react";
import { cx } from "@/utils/cx";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * BoardUI (React Aria Components) 后端的 Sheet 复合 API（边缘抽屉）。
 * 保持原 Base UI 版本的导出名与 props 形态；side/variant 定位样式逐条保留。
 * SheetPortal/SheetBackdrop 为兼容包装（portal 与遮罩由 ModalOverlay 自带）。
 */

interface SheetState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const SheetCtx = React.createContext<SheetState>({
  isOpen: false,
  open: () => {},
  close: () => {},
});

function renderWith(
  element: React.ReactElement,
  {
    className,
    children,
    onClick,
    ...rest
  }: {
    className?: string;
    children?: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
    [key: string]: unknown;
  },
): React.ReactElement {
  const own = (element.props ?? {}) as {
    className?: string;
    children?: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
  };
  return React.cloneElement(element, {
    ...rest,
    className: cx(className, own.className),
    onClick: (e: React.MouseEvent) => {
      own.onClick?.(e);
      if (!e.defaultPrevented) onClick?.(e);
    },
    children: children !== undefined ? children : own.children,
  } as Record<string, unknown>);
}

export function Sheet({
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
}): React.JSX.Element {
  const [innerOpen, setInnerOpen] = React.useState(Boolean(defaultOpen));
  const isOpen = open ?? innerOpen;
  const set = React.useCallback(
    (next: boolean) => {
      setInnerOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );
  const state = React.useMemo<SheetState>(
    () => ({ isOpen, open: () => set(true), close: () => set(false) }),
    [isOpen, set],
  );
  void props;
  return <SheetCtx value={state}>{children}</SheetCtx>;
}

export function SheetTrigger({
  render,
  ...rest
}: {
  render?: React.ReactElement;
  [key: string]: unknown;
}): React.JSX.Element {
  const { open } = React.useContext(SheetCtx);
  return renderWith(render ?? <button type="button" />, { ...rest, onClick: open });
}

export function SheetClose({
  render,
  ...rest
}: {
  render?: React.ReactElement;
  [key: string]: unknown;
}): React.JSX.Element {
  const { close } = React.useContext(SheetCtx);
  return renderWith(render ?? <button type="button" />, { ...rest, onClick: close });
}

/** 兼容包装：原样透传 children。 */
export function SheetPortal({
  children,
  ...props
}: {
  children?: React.ReactNode;
  [key: string]: unknown;
}): React.JSX.Element {
  void props;
  return <>{children}</>;
}

/** 兼容包装：遮罩由 ModalOverlay 的 overlay className 绘制。 */
export function SheetBackdrop({
  className,
  ...props
}: {
  className?: string;
  [key: string]: unknown;
}): null {
  void className;
  void props;
  return null;
}

export function SheetViewport({
  className,
  side,
  variant = "default",
  ...props
}: {
  side?: "right" | "left" | "top" | "bottom";
  variant?: "default" | "inset";
  className?: string;
  [key: string]: unknown;
}): React.JSX.Element {
  return (
    <div
      className={cx(
        "fixed inset-0 z-100 grid",
        side === "bottom" && "grid grid-rows-[1fr_auto] pt-12",
        side === "top" && "grid grid-rows-[auto_1fr] pb-12",
        side === "left" && "flex justify-start",
        side === "right" && "flex justify-end",
        variant === "inset" && "sm:p-4",
        className,
      )}
      data-slot="sheet-viewport"
      {...props}
    />
  );
}

export function SheetPopup({
  className,
  children,
  showCloseButton = true,
  side = "right",
  variant = "default",
  closeProps,
  portalProps,
  ...props
}: {
  className?: string;
  children?: React.ReactNode;
  showCloseButton?: boolean;
  side?: "right" | "left" | "top" | "bottom";
  variant?: "default" | "inset";
  closeProps?: Record<string, unknown>;
  portalProps?: Record<string, unknown>;
  [key: string]: unknown;
}): React.JSX.Element {
  void portalProps;
  const { isOpen, close } = React.useContext(SheetCtx);
  return (
    <AriaModalOverlay
      isDismissable
      isOpen={isOpen}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      className="fixed inset-0 z-100 bg-black/70 outline-none backdrop-blur-sm transition-opacity duration-200 data-[entering]:opacity-0 data-[exiting]:opacity-0"
    >
      <SheetViewport side={side} variant={variant}>
        <AriaModal
          className={cx(
            "relative flex max-h-full min-h-0 w-full min-w-0 flex-col bg-background-full text-text-primary shadow-xs transition-[opacity,translate] duration-200 ease-in-out will-change-transform data-[entering]:opacity-0 data-[exiting]:opacity-0",
            side === "bottom" &&
              "row-start-2 border-t border-separator-border data-[entering]:translate-y-8 data-[exiting]:translate-y-8",
            side === "top" &&
              "border-b border-separator-border data-[entering]:-translate-y-8 data-[exiting]:-translate-y-8",
            side === "left" &&
              "w-[calc(100%-(--spacing(12)))] max-w-md border-e border-separator-border data-[entering]:-translate-x-8 data-[exiting]:-translate-x-8",
            side === "right" &&
              "col-start-2 w-[calc(100%-(--spacing(12)))] max-w-md border-s border-separator-border data-[entering]:translate-x-8 data-[exiting]:translate-x-8",
            variant === "inset" &&
              "sm:rounded-2xl sm:border sm:border-separator-border",
            className,
          )}
          data-slot="sheet-popup"
          {...props}
        >
          {children}
          {showCloseButton && (
            <Button
              aria-label="Close"
              onClick={close}
              className="absolute end-2 top-2"
              size="icon"
              variant="ghost"
              {...closeProps}
            >
              <XIcon />
            </Button>
          )}
        </AriaModal>
      </SheetViewport>
    </AriaModalOverlay>
  );
}

export function SheetHeader({
  className,
  render,
  ...props
}: {
  className?: string;
  render?: React.ReactElement;
  [key: string]: unknown;
}): React.JSX.Element {
  return renderWith(render ?? <div />, {
    ...props,
    className: cx("flex flex-col gap-2 p-6 max-sm:pb-4", className),
    "data-slot": "sheet-header",
  });
}

export function SheetFooter({
  className,
  variant = "default",
  render,
  ...props
}: {
  className?: string;
  variant?: "default" | "bare";
  render?: React.ReactElement;
  [key: string]: unknown;
}): React.JSX.Element {
  return renderWith(render ?? <div />, {
    ...props,
    className: cx(
      "flex flex-col-reverse gap-2 px-6 sm:flex-row sm:justify-end",
      variant === "default" &&
        "border-t border-separator-border bg-background-secondary-default/70 py-4",
      variant === "bare" && "pt-4 pb-6",
      className,
    ),
    "data-slot": "sheet-footer",
  });
}

export function SheetTitle({
  className,
  ...props
}: {
  className?: string;
  [key: string]: unknown;
}): React.JSX.Element {
  return (
    <AriaHeading
      slot="title"
      className={cx("text-title-2-medium text-text-primary", className)}
      data-slot="sheet-title"
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: {
  className?: string;
  [key: string]: unknown;
}): React.JSX.Element {
  return (
    <AriaText
      slot="description"
      className={cx("text-body-regular text-text-secondary", className)}
      data-slot="sheet-description"
      {...props}
    />
  );
}

export function SheetPanel({
  className,
  scrollFade = true,
  render,
  ...props
}: {
  className?: string;
  scrollFade?: boolean;
  render?: React.ReactElement;
  [key: string]: unknown;
}): React.JSX.Element {
  return (
    <ScrollArea overscrollContain scrollFade={scrollFade}>
      {renderWith(render ?? <div />, {
        ...props,
        className,
        "data-slot": "sheet-panel",
      })}
    </ScrollArea>
  );
}

/** 兼容再导出：旧 Base UI Primitive 命名空间（本文件外部无消费方）。 */
const SheetPrimitive = {
  Root: Sheet,
  Trigger: SheetTrigger,
  Close: SheetClose,
  Portal: SheetPortal,
  Backdrop: SheetBackdrop,
  Viewport: SheetViewport,
  Popup: SheetPopup,
  Title: SheetTitle,
  Description: SheetDescription,
} as const;

export {
  SheetPrimitive,
  SheetBackdrop as SheetOverlay,
  SheetPopup as SheetContent,
};
