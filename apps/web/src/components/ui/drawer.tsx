"use client";

import { Drawer as DrawerPrimitive } from "vaul";
import * as React from "react";
import { cx } from "@/utils/cx";

// Mini App 运行时兼容层：存量 Mini App 经 @flow-spaces/ui / window.FlowSpacesUI
// 消费 shadcn/ui Drawer 的完整 API 表面（lib/ui-exports.ts 再导出）。
// 业务代码请改用 @/components/base/*；此文件仅为 Mini App 平台契约保留。
/**
 * BoardUI 视觉的 Drawer（底部抽屉），基于已装的 vaul（拖拽跟随、下滑关闭）。
 * 导出名与 shadcn/ui Drawer 一一对齐：Drawer / DrawerTrigger / DrawerPortal /
 * DrawerClose / DrawerOverlay / DrawerContent / DrawerHeader / DrawerFooter /
 * DrawerTitle / DrawerDescription / DrawerHandle。
 * 样式 token 对齐 components/ui/sheet.tsx（bg-background-full /
 * border-separator-border / text-title-2-medium / text-body-regular）。
 */

function Drawer({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>): React.JSX.Element {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}

function DrawerTrigger({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>): React.JSX.Element {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerPortal({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>): React.JSX.Element {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerClose({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>): React.JSX.Element {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>): React.JSX.Element {
  return (
    <DrawerPrimitive.Overlay
      className={cx(
        "fixed inset-0 z-100 bg-black/70 outline-none backdrop-blur-sm",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        className,
      )}
      data-slot="drawer-overlay"
      {...props}
    />
  );
}

function DrawerContent({
  className,
  children,
  showHandle = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content> & {
  /** 顶部拖拽把手（vaul drag handle 视觉提示），可关闭。 */
  showHandle?: boolean;
}): React.JSX.Element {
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        className={cx(
          "fixed inset-x-0 bottom-0 z-100 mx-auto flex h-auto max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl border-t border-separator-border bg-background-full text-text-primary shadow-xs outline-none",
          "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
          className,
        )}
        data-slot="drawer-content"
        {...props}
      >
        {showHandle && (
          <div
            className="mx-auto mt-4 h-1.5 w-24 shrink-0 cursor-grab rounded-full bg-separator-border-strong"
            data-slot="drawer-handle"
          />
        )}
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
}

function DrawerHeader({
  className,
  ...props
}: React.ComponentProps<"div">): React.JSX.Element {
  return (
    <div
      className={cx("flex flex-col gap-2 px-6 pt-4 pb-2 max-sm:pb-1", className)}
      data-slot="drawer-header"
      {...props}
    />
  );
}

function DrawerFooter({
  className,
  ...props
}: React.ComponentProps<"div">): React.JSX.Element {
  return (
    <div
      className={cx(
        "mt-auto flex flex-col-reverse gap-2 px-6 pt-4 pb-6 sm:flex-row sm:justify-end",
        className,
      )}
      data-slot="drawer-footer"
      {...props}
    />
  );
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>): React.JSX.Element {
  return (
    <DrawerPrimitive.Title
      className={cx("text-title-2-medium text-text-primary", className)}
      data-slot="drawer-title"
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>): React.JSX.Element {
  return (
    <DrawerPrimitive.Description
      className={cx("text-body-regular text-text-secondary", className)}
      data-slot="drawer-description"
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerTrigger,
  DrawerPortal,
  DrawerClose,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
