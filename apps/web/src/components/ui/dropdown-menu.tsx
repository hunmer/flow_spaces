"use client"

import * as React from "react"
import {
  Header as AriaHeader,
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  MenuSection as AriaMenuSection,
  MenuTrigger as AriaMenuTrigger,
  Popover as AriaPopover,
  Pressable as AriaPressable,
  Separator as AriaSeparator,
  SubmenuTrigger as AriaSubmenuTrigger,
} from "react-aria-components"

import { cn } from "@/lib/utils"
import { ChevronRightIcon, CheckIcon } from "lucide-react"

/**
 * BoardUI (React Aria Components) 后端的 DropdownMenu 复合 API。
 * 保持原 Base UI 版本的导出名与 props 形态：Root hoist Trigger/Content
 * 进 AriaMenuTrigger；Checkbox/Radio 用手绘指示器桥接 Base UI 语义。
 */

type LooseProps = Record<string, unknown>

function renderWith(
  element: React.ReactElement,
  {
    className,
    children,
    onClick,
    ...rest
  }: {
    className?: string
    children?: React.ReactNode
    onClick?: (e: React.MouseEvent) => void
    [key: string]: unknown
  },
): React.ReactElement {
  const own = (element.props ?? {}) as {
    className?: string
    children?: React.ReactNode
    onClick?: (e: React.MouseEvent) => void
  }
  return React.cloneElement(element, {
    ...rest,
    className: cn(className, own.className),
    onClick: (e: React.MouseEvent) => {
      own.onClick?.(e)
      if (!e.defaultPrevented) onClick?.(e)
    },
    children: children !== undefined ? children : own.children,
  } as Record<string, unknown>)
}

function DropdownMenu({
  open,
  onOpenChange,
  defaultOpen,
  children,
  ...props
}: {
  open?: boolean
  onOpenChange?: (open: boolean, ...rest: unknown[]) => void
  defaultOpen?: boolean
  children?: React.ReactNode
  [key: string]: unknown
}) {
  const items = React.Children.toArray(children).filter(React.isValidElement)
  const trigger = items.find((i) => i.type === DropdownMenuTrigger)
  const content = items.find((i) => i.type === DropdownMenuContent)
  const rest = items.filter((i) => i !== trigger && i !== content)
  void props
  return (
    <AriaMenuTrigger
      isOpen={open}
      defaultOpen={defaultOpen}
      onOpenChange={(next) => onOpenChange?.(next)}
    >
      {trigger}
      {content}
      {rest}
    </AriaMenuTrigger>
  )
}

function DropdownMenuPortal({
  children,
  ...props
}: {
  children?: React.ReactNode
  [key: string]: unknown
}) {
  void props
  return <>{children}</>
}

function DropdownMenuTrigger({
  render,
  asChild = false,
  children,
  className,
  ...rest
}: {
  render?: React.ReactElement
  asChild?: boolean
  children?: React.ReactNode
  className?: string
  onClick?: (e: React.MouseEvent) => void
  onPointerDown?: (e: React.PointerEvent) => void
  onContextMenu?: (e: React.MouseEvent) => void
  [key: string]: unknown
}) {
  // 兼容旧版 asChild API，直接复用子元素，避免 button 嵌套。
  const element = render ?? (asChild
    ? React.Children.only(children) as React.ReactElement
    : <button type="button" />)
  // AriaMenuTrigger 不 clone 子元素，而是提供 PressResponderContext；
  // 只有内部走 usePress 的组件（如 RAC Pressable）才会消费并注入
  // press/aria-haspopup/aria-expanded。这里用 Pressable 把交互行为
  // clone 到最终渲染元素（裸 button 或消费者 render 的 cossui Button）。
  return (
    <AriaPressable>
      {renderWith(element, {
        className,
        ...rest,
        ...(!asChild ? { children } : {}),
      }) as React.ReactElement<React.DOMAttributes<HTMLElement>, "button">}
    </AriaPressable>
  )
}

const SIDE_MAP: Record<string, string> = {
  "inline-start": "left",
  "inline-end": "right",
}

type Placement = ReturnType<typeof placementOf>

function placementOf(
  side: string,
  align: string,
):
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top left"
  | "top right"
  | "bottom left"
  | "bottom right"
  | "left top"
  | "left bottom"
  | "right top"
  | "right bottom" {
  const s = (SIDE_MAP[side] ?? side) as "top" | "bottom" | "left" | "right"
  if (s === "left" || s === "right") {
    return align === "end" ? `${s} bottom` : `${s} top`
  }
  if (align === "start") return `${s} left`
  if (align === "end") return `${s} right`
  return s
}

interface ItemBridgeProps {
  onClick?: (e: React.SyntheticEvent<HTMLElement>) => void
  onSelect?: (e: React.SyntheticEvent<HTMLElement>) => void
}

const FALLBACK_EVENT = {
  defaultPrevented: false,
  stopPropagation: () => {},
  preventDefault: () => {},
} as unknown as React.SyntheticEvent<HTMLElement>

/**
 * RAC onAction 无 DOM 事件；用 onPointerDown 捕获最近事件，桥接
 * Base UI 的 onClick(e)/onSelect(e)。注：本版 RAC 的 shouldCloseOnSelect
 * 仅接受 boolean，onSelect preventDefault 的「保持菜单打开」语义不可用。
 */
function useItemBridge({ onSelect, onClick }: ItemBridgeProps) {
  const lastEvent = React.useRef<React.SyntheticEvent<HTMLElement> | null>(null)
  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    lastEvent.current = e
  }
  const onAction = () => {
    const ev = lastEvent.current
    if (ev) onSelect?.(ev)
    onClick?.(ev ?? FALLBACK_EVENT)
  }
  return { onPointerDown, onAction }
}

const MENU_SURFACE =
  "z-110 max-h-[calc(100vh-24px)] min-w-32 overflow-x-hidden overflow-y-auto rounded-2xl border border-border-button-default bg-background-primary-default p-1 text-text-primary shadow-dropdown duration-100 outline-none"

function DropdownMenuContent({
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  className,
  children,
  ...props
}: {
  align?: "start" | "center" | "end"
  alignOffset?: number
  side?: "top" | "bottom" | "left" | "right"
  sideOffset?: number
  className?: string
  children?: React.ReactNode
  [key: string]: unknown
}) {
  void props
  return (
    <AriaPopover
      placement={placementOf(side, align)}
      offset={sideOffset}
      crossOffset={alignOffset}
      className="z-110 isolate outline-none"
    >
      <AriaMenu
        data-slot="dropdown-menu-content"
        className={cn(MENU_SURFACE, className)}
      >
        {children}
      </AriaMenu>
    </AriaPopover>
  )
}

function DropdownMenuGroup({
  className,
  children,
  ...props
}: {
  className?: string
  children?: React.ReactNode
  [key: string]: unknown
}) {
  void props
  return (
    <AriaMenuSection
      data-slot="dropdown-menu-group"
      className={cn("outline-none", className)}
    >
      {children}
    </AriaMenuSection>
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: {
  inset?: boolean
  className?: string
  [key: string]: unknown
}) {
  return (
    <AriaHeader
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-1.5 py-1 text-xs font-medium text-text-secondary data-inset:pl-7",
        className,
      )}
      {...props}
    />
  )
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  onClick,
  onSelect,
  disabled,
  closeOnClick,
  onPointerDown,
  ...props
}: {
  inset?: boolean
  variant?: "default" | "destructive"
  onClick?: (e: React.SyntheticEvent<HTMLElement>) => void
  onSelect?: (e: React.SyntheticEvent<HTMLElement>) => void
  disabled?: boolean
  closeOnClick?: boolean
  onPointerDown?: (e: React.PointerEvent<HTMLElement>) => void
  className?: string
  [key: string]: unknown
}) {
  const bridge = useItemBridge({ onClick, onSelect })
  return (
    <AriaMenuItem
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      isDisabled={disabled}
      onPointerDown={(e: React.PointerEvent<HTMLElement>) => {
        onPointerDown?.(e)
        bridge.onPointerDown(e)
      }}
      shouldCloseOnSelect={closeOnClick}
      onAction={bridge.onAction}
      className={cn(
        "group/dropdown-menu-item relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-dropdown-item-hover-background data-inset:pl-7 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-background-tertiary-error data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[variant=destructive]:*:[svg]:text-destructive",
        className,
      )}
      {...props}
    />
  )
}

function DropdownMenuSub({
  children,
  open,
  onOpenChange,
  ...props
}: {
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  [key: string]: unknown
}) {
  const items = React.Children.toArray(children).filter(React.isValidElement)
  const trigger = items.find((i) => i.type === DropdownMenuSubTrigger)
  const content = items.find((i) => i.type === DropdownMenuSubContent)
  const rest = items.filter((i) => i !== trigger && i !== content)
  void props
  void open
  void onOpenChange
  return (
    <AriaSubmenuTrigger>
      {[trigger, content, ...rest].filter(
        (i): i is React.ReactElement => i != null,
      )}
    </AriaSubmenuTrigger>
  )
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  disabled,
  ...props
}: {
  inset?: boolean
  disabled?: boolean
  className?: string
  children?: React.ReactNode
  [key: string]: unknown
}) {
  return (
    <AriaMenuItem
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      isDisabled={disabled}
      className={cn(
        "flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-dropdown-item-hover-background data-inset:pl-7 data-open:bg-dropdown-item-hover-background data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto" />
    </AriaMenuItem>
  )
}

function DropdownMenuSubContent({
  align = "start",
  alignOffset = -3,
  side = "right",
  sideOffset = 0,
  className,
  children,
  ...props
}: {
  align?: "start" | "center" | "end"
  alignOffset?: number
  side?: "top" | "bottom" | "left" | "right"
  sideOffset?: number
  className?: string
  children?: React.ReactNode
  [key: string]: unknown
}) {
  void props
  return (
    <AriaPopover
      placement={placementOf(side, align)}
      offset={sideOffset}
      crossOffset={alignOffset}
      className="z-110 isolate outline-none"
    >
      <AriaMenu
        data-slot="dropdown-menu-sub-content"
        className={cn(
          MENU_SURFACE,
          "w-auto min-w-[96px]",
          className,
        )}
      >
        {children}
      </AriaMenu>
    </AriaPopover>
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  onClick,
  onSelect,
  onCheckedChange,
  disabled,
  onPointerDown,
  ...props
}: {
  checked?: boolean | "indeterminate"
  inset?: boolean
  onClick?: (e: React.SyntheticEvent<HTMLElement>) => void
  onSelect?: (e: React.SyntheticEvent<HTMLElement>) => void
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  onPointerDown?: (e: React.PointerEvent<HTMLElement>) => void
  className?: string
  children?: React.ReactNode
  [key: string]: unknown
}) {
  const bridge = useItemBridge({ onClick, onSelect })
  return (
    <AriaMenuItem
      data-slot="dropdown-menu-checkbox-item"
      data-inset={inset}
      isDisabled={disabled}
      onPointerDown={(e: React.PointerEvent<HTMLElement>) => {
        onPointerDown?.(e)
        bridge.onPointerDown(e)
      }}
      onAction={() => {
        bridge.onAction()
        onCheckedChange?.(!checked)
      }}
      className={cn(
        "relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-dropdown-item-hover-background data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...(props as LooseProps)}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-checkbox-item-indicator"
      >
        {checked ? <CheckIcon /> : null}
      </span>
      {children}
    </AriaMenuItem>
  )
}

const RadioGroupCtx = React.createContext<{
  value?: string
  onValueChange?: (value: string) => void
}>({})

/** 供 menubar 等薄包装读取当前 radio 选择（内部 API，勿在业务代码使用）。 */
export { RadioGroupCtx as DropdownMenuRadioGroupCtx }

function DropdownMenuRadioGroup({
  value,
  onValueChange,
  children,
  ...props
}: {
  value?: string
  onValueChange?: (value: string) => void
  children?: React.ReactNode
  [key: string]: unknown
}) {
  void props
  return (
    <RadioGroupCtx value={{ value, onValueChange }}>
      <AriaMenuSection
        data-slot="dropdown-menu-radio-group"
        className="outline-none"
      >
        {children}
      </AriaMenuSection>
    </RadioGroupCtx>
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  inset,
  value,
  onClick,
  onSelect,
  disabled,
  ...props
}: {
  value?: string
  inset?: boolean
  onClick?: (e: React.SyntheticEvent<HTMLElement>) => void
  onSelect?: (e: React.SyntheticEvent<HTMLElement>) => void
  disabled?: boolean
  onPointerDown?: (e: React.PointerEvent<HTMLElement>) => void
  className?: string
  children?: React.ReactNode
  [key: string]: unknown
}) {
  const group = React.useContext(RadioGroupCtx)
  const bridge = useItemBridge({ onClick, onSelect })
  return (
    <AriaMenuItem
      data-slot="dropdown-menu-radio-item"
      data-inset={inset}
      isDisabled={disabled}
      onPointerDown={(e: React.PointerEvent<HTMLElement>) => bridge.onPointerDown(e)}
      onAction={() => {
        bridge.onAction()
        if (value !== undefined) group.onValueChange?.(value)
      }}
      className={cn(
        "relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-dropdown-item-hover-background data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        {group.value !== undefined && value === group.value ? (
          <CheckIcon />
        ) : null}
      </span>
      {children}
    </AriaMenuItem>
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: {
  className?: string
  [key: string]: unknown
}) {
  return (
    <AriaSeparator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-separator-border", className)}
      {...props}
    />
  )
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ms-auto font-medium font-sans text-xs tracking-widest text-text-secondary",
        className,
      )}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
