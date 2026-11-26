"use client";


// Mini App 运行时兼容层：存量 Mini App 经 @flow-spaces/ui / window.AgentSpacesUI
// 消费此组件的旧 API 表面（lib/ui-exports.ts 再导出）。
// 业务代码请改用 @/components/base/*；此文件仅为 Mini App 平台契约保留。
import * as React from "react";
import {
  Pressable as AriaPressable,
  Tooltip as AriaTooltip,
  TooltipTrigger as AriaTooltipTrigger,
} from "react-aria-components";
import { cx } from "@/utils/cx";

/**
 * BoardUI (React Aria Components) 后端的 Tooltip 复合 API。
 * 保持原 Base UI 版本的导出名与 props 形态：
 * - <Tooltip open onOpenChange delay closeDelay>
 * - <TooltipTrigger render={<Button/>}>children</TooltipTrigger>
 *   （render 元素被 clone 并合并 props/children，等价 Base UI render 语义；
 *    本组件自身也可能被外部（如 sidebar-menu 的 useRender）clone 注入 props，
 *    因此所有未知 props 原样透传到最终元素）
 * - <TooltipContent side align sideOffset hidden className>
 */

type TooltipProviderValue = { delay?: number; closeDelay?: number };

const TooltipProviderCtx = React.createContext<TooltipProviderValue>({});

export function TooltipProvider({
  delay,
  closeDelay,
  children,
  ...props
}: React.ComponentProps<"div"> & TooltipProviderValue): React.ReactElement {
  return (
    <TooltipProviderCtx value={{ delay, closeDelay }}>
      <div {...props}>{children}</div>
    </TooltipProviderCtx>
  );
}

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

export function Tooltip({
  open,
  onOpenChange,
  defaultOpen,
  delay,
  closeDelay,
  children,
  ...props
}: {
  open?: boolean;
  onOpenChange?: (open: boolean, ...rest: unknown[]) => void;
  defaultOpen?: boolean;
  delay?: number;
  closeDelay?: number;
  children?: React.ReactNode;
  [key: string]: unknown;
}): React.ReactElement {
  const provider = React.useContext(TooltipProviderCtx);
  return (
    <AriaTooltipTrigger
      isOpen={open}
      defaultOpen={defaultOpen}
      onOpenChange={(next) => onOpenChange?.(next)}
      delay={delay ?? provider.delay}
      closeDelay={closeDelay ?? provider.closeDelay}
      {...props}
    >
      {children}
    </AriaTooltipTrigger>
  );
}

export function TooltipTrigger({
  render,
  children,
  className,
  ...props
}: {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  render?: React.ReactElement | ((props: any, state?: any) => React.ReactElement);
  children?: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  [key: string]: unknown;
}): React.ReactElement {
  const element =
    typeof render === "function"
      ? render({ ...props, className, children } as Record<string, unknown>)
      : (render ?? <button type="button" />);
  const own = element.props as { className?: string; children?: React.ReactNode };
  // AriaTooltipTrigger 不 clone 子元素，而是提供 FocusableProvider
  // （含 hover/focus handlers）。只有内部走 useFocusable/usePress 的
  // 组件（如 RAC Pressable）才消费。用 Pressable 把这些 handlers
  // clone 到最终元素上，否则 tooltip 永远不会显示。
  return (
    <AriaPressable>
      {React.cloneElement(element, {
        ...props,
        className: cx(className, own.className),
        children: children ?? own.children,
      } as Record<string, unknown>) as unknown as React.ReactElement<React.DOMAttributes<HTMLElement>, "button">}
    </AriaPressable>
  );
}

export function TooltipPopup({
  className,
  side = "top",
  align = "center",
  sideOffset = 4,
  hidden,
  children,
  ...props
}: {
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  hidden?: boolean;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  [key: string]: unknown;
}): React.ReactNode {
  if (hidden) return null;
  return (
    <AriaTooltip
      offset={sideOffset}
      placement={toAriaPlacement(side, align) as never}
      className={cx(
        "z-120 relative max-w-[240px] rounded-lg border border-border-button-default bg-background-primary-default px-2 py-1 text-balance text-xs text-text-primary shadow-dropdown outline-none transition-opacity duration-150 data-[entering]:opacity-0 data-[exiting]:opacity-0",
        className,
      )}
      data-slot="tooltip-popup"
      {...props}
    >
      {children}
    </AriaTooltip>
  );
}

/** 兼容占位：旧 Base UI createHandle 无消费方。 */
export const TooltipCreateHandle: () => { open: () => void; close: () => void } =
  () => ({ open: () => {}, close: () => {} });

/** 兼容再导出：旧 Base UI Primitive 命名空间（本文件外部无消费方）。 */
const TooltipPrimitive = {
  Root: Tooltip,
  Trigger: TooltipTrigger,
  Popup: TooltipPopup,
} as const;

export { TooltipPrimitive, TooltipPopup as TooltipContent };
