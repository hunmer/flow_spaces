"use client"

import * as React from "react"
import {
  Pressable as AriaPressable,
  Tooltip as AriaTooltip,
  TooltipTrigger as AriaTooltipTrigger,
} from "react-aria-components"
import { cn } from "@/lib/utils"

/**
 * BoardUI (React Aria Components) 后端的 HoverCard 复合 API。
 * RAC 无独立 PreviewCard，用 TooltipTrigger（hover 语义相同，支持
 * delay/closeDelay）+ 任意内容 Tooltip 实现：
 * - <HoverCard openDelay closeDelay open onOpenChange>
 * - <HoverCardTrigger render={<div/>} className>children</HoverCardTrigger>
 * - <HoverCardContent side align sideOffset className>
 */

function toAriaPlacement(side: string, align: string): string {
  const a = align === "start" ? "start" : align === "end" ? "end" : "center"
  if (side === "left" || side === "right") {
    if (a === "start") return `${side} top`
    if (a === "end") return `${side} bottom`
    return side
  }
  if (a === "start") return `${side} left`
  if (a === "end") return `${side} right`
  return side
}

function HoverCard({
  openDelay = 300,
  closeDelay = 200,
  open,
  onOpenChange,
  defaultOpen,
  children,
  ...props
}: {
  openDelay?: number
  closeDelay?: number
  open?: boolean
  onOpenChange?: (open: boolean, ...rest: unknown[]) => void
  defaultOpen?: boolean
  children?: React.ReactNode
  [key: string]: unknown
}) {
  return (
    <AriaTooltipTrigger
      delay={openDelay}
      closeDelay={closeDelay}
      isOpen={open}
      defaultOpen={defaultOpen}
      onOpenChange={(next) => onOpenChange?.(next)}
      {...props}
    >
      {children}
    </AriaTooltipTrigger>
  )
}

function HoverCardTrigger({
  render,
  children,
  className,
  ...props
}: {
  render?: React.ReactElement
  children?: React.ReactNode
  className?: string
  [key: string]: unknown
}) {
  const element = render ?? <span />
  const own = element.props as { className?: string; children?: React.ReactNode }
  // AriaTooltipTrigger 只提供 FocusableProvider context，不 clone 子元素；
  // 用 Pressable 消费 context 并把 hover/focus handlers 注入最终元素。
  return (
    <AriaPressable>
      {React.cloneElement(element, {
        ...props,
        className: cn(className, own.className),
        children: children ?? own.children,
      } as Record<string, unknown>) as unknown as React.ReactElement<React.DOMAttributes<HTMLElement>, "button">}
    </AriaPressable>
  )
}

function HoverCardContent({
  className,
  side = "bottom",
  align = "center",
  sideOffset = 6,
  children,
  ...props
}: {
  className?: string
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
  sideOffset?: number
  children?: React.ReactNode
  onClick?: (e: React.MouseEvent) => void
  onPointerDown?: (e: React.PointerEvent) => void
  onMouseDown?: (e: React.MouseEvent) => void
  onContextMenu?: (e: React.MouseEvent) => void
  onKeyDown?: (e: React.KeyboardEvent) => void
  [key: string]: unknown
}) {
  return (
    <AriaTooltip
      offset={sideOffset}
      placement={toAriaPlacement(side, align) as never}
      className={cn(
        "z-110 rounded-[20px] border border-border-button-default bg-background-primary-default p-3 text-text-primary shadow-dropdown outline-none transition-opacity duration-200 data-[entering]:opacity-0 data-[exiting]:opacity-0",
        className,
      )}
      {...props}
    >
      {children}
    </AriaTooltip>
  )
}

export { HoverCard, HoverCardContent, HoverCardTrigger }
