"use client";

import {
  Dialog as AriaDialog,
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
 * BoardUI (React Aria Components) 后端的 Dialog 复合 API。
 * 保持原 Base UI 版本的导出名与 props 形态：
 * - <Dialog open onOpenChange defaultOpen>
 * - <DialogTrigger render={<Button/>}>…</DialogTrigger>（render 元素被 clone 合并）
 * - <DialogClose render={<Button/>}>…</DialogClose>
 * - <DialogContent showCloseButton bottomStickOnMobile closeProps className>
 * - DialogPortal/DialogBackdrop/DialogViewport 保留为兼容包装（portal 与遮罩
 *   由 RAC ModalOverlay 自带，显式渲染它们无害）。
 */

interface DialogState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const DialogCtx = React.createContext<DialogState>({
  isOpen: false,
  open: () => {},
  close: () => {},
});

/** 本地 useRender 等价物：把 className/children/onClick 合并进 render 元素。 */
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

export function Dialog({
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
  const state = React.useMemo<DialogState>(
    () => ({ isOpen, open: () => set(true), close: () => set(false) }),
    [isOpen, set],
  );
  void props;
  return <DialogCtx value={state}>{children}</DialogCtx>;
}

export function DialogTrigger({
  render,
  ...rest
}: {
  render?: React.ReactElement;
  [key: string]: unknown;
}): React.JSX.Element {
  const { open } = React.useContext(DialogCtx);
  const element = render ?? <button type="button" />;
  return renderWith(element, { ...rest, onClick: open });
}

export function DialogClose({
  render,
  ...rest
}: {
  render?: React.ReactElement;
  [key: string]: unknown;
}): React.JSX.Element {
  const { close } = React.useContext(DialogCtx);
  const element = render ?? <button type="button" />;
  return renderWith(element, { ...rest, onClick: close });
}

/** 兼容包装：portal 由 ModalOverlay 自带，这里原样透传 children。 */
export function DialogPortal({
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
export function DialogBackdrop({
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

export function DialogViewport({
  className,
  ...props
}: {
  className?: string;
  [key: string]: unknown;
}): React.JSX.Element {
  return (
    <div
      className={cx(
        "fixed inset-0 grid grid-rows-[1fr_auto_3fr] justify-items-center p-4",
        className,
      )}
      data-slot="dialog-viewport"
      {...props}
    />
  );
}

export function DialogPopup({
  className,
  children,
  showCloseButton = true,
  bottomStickOnMobile = true,
  closeProps,
  portalProps,
  ...props
}: {
  className?: string;
  children?: React.ReactNode;
  showCloseButton?: boolean;
  bottomStickOnMobile?: boolean;
  closeProps?: Record<string, unknown>;
  portalProps?: Record<string, unknown>;
  [key: string]: unknown;
}): React.JSX.Element {
  void portalProps;
  const { isOpen, close } = React.useContext(DialogCtx);
  return (
    <AriaModalOverlay
      isDismissable
      isOpen={isOpen}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      className="fixed inset-0 z-100 bg-black/70 outline-none backdrop-blur-sm transition-opacity duration-200 data-[entering]:opacity-0 data-[exiting]:opacity-0"
    >
      <DialogViewport
        className={cx(
          bottomStickOnMobile &&
            "max-sm:grid-rows-[1fr_auto] max-sm:p-0 max-sm:pt-12",
        )}
      >
        <AriaModal
          className={cx(
            "relative row-start-2 flex max-h-full min-h-0 w-full min-w-0 max-w-lg origin-center flex-col rounded-3xl border border-separator-border bg-background-full p-6 text-text-primary opacity-[calc(1)] shadow-xs outline-none transition-[scale,opacity,translate] duration-200 ease-in-out will-change-transform data-[entering]:scale-98 data-[entering]:opacity-0 data-[exiting]:scale-98 data-[exiting]:opacity-0",
            bottomStickOnMobile &&
              "max-sm:max-w-none max-sm:origin-bottom max-sm:rounded-none max-sm:border-x-0 max-sm:border-t max-sm:border-b-0 max-sm:border-separator-border max-sm:data-[entering]:translate-y-4 max-sm:data-[exiting]:translate-y-4",
            className,
          )}
          data-slot="dialog-popup"
          {...props}
        >
          {/* RAC Modal 不透传 role/aria-modal；由 Dialog 提供 role=dialog */}
          <AriaDialog className="contents outline-none">
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
          </AriaDialog>
        </AriaModal>
      </DialogViewport>
    </AriaModalOverlay>
  );
}

export function DialogHeader({
  className,
  render,
  ...props
}: {
  className?: string;
  render?: React.ReactElement;
  [key: string]: unknown;
}): React.JSX.Element {
  const element = render ?? <div />;
  return renderWith(element, {
    ...props,
    className: cx(
      "flex flex-col gap-2 pb-6 max-sm:pb-4",
      className,
    ),
    "data-slot": "dialog-header",
  });
}

export function DialogFooter({
  className,
  variant = "bare",
  render,
  ...props
}: {
  className?: string;
  variant?: "default" | "bare";
  render?: React.ReactElement;
  [key: string]: unknown;
}): React.JSX.Element {
  const element = render ?? <div />;
  return renderWith(element, {
    ...props,
    className: cx(
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:rounded-b-[calc(var(--radius-3xl)-1px)]",
      variant === "default" &&
        "-mx-6 -mb-6 border-t border-separator-border bg-background-secondary-default/70 px-6 py-4",
      variant === "bare" && "pt-4",
      className,
    ),
    "data-slot": "dialog-footer",
  });
}

export function DialogTitle({
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
      data-slot="dialog-title"
      {...props}
    />
  );
}

export function DialogDescription({
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
      data-slot="dialog-description"
      {...props}
    />
  );
}

export function DialogPanel({
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
  const element = render ?? <div />;
  return (
    <ScrollArea overscrollContain scrollFade={scrollFade}>
      {renderWith(element, {
        ...props,
        className,
        "data-slot": "dialog-panel",
      })}
    </ScrollArea>
  );
}

/** 兼容占位：旧 Base UI createHandle 无消费方。 */
export const DialogCreateHandle: () => { open: () => void; close: () => void } =
  () => ({ open: () => {}, close: () => {} });

/** 兼容再导出：旧 Base UI Primitive 命名空间（本文件外部无消费方）。 */
const DialogPrimitive = {
  Root: Dialog,
  Trigger: DialogTrigger,
  Close: DialogClose,
  Portal: DialogPortal,
  Backdrop: DialogBackdrop,
  Viewport: DialogViewport,
  Popup: DialogPopup,
  Title: DialogTitle,
  Description: DialogDescription,
} as const;

export {
  DialogPrimitive,
  DialogBackdrop as DialogOverlay,
  DialogPopup as DialogContent,
};
