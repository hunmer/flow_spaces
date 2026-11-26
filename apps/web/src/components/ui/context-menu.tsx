"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import {
  Header as AriaHeader,
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  MenuSection as AriaMenuSection,
  Separator as AriaSeparator,
} from "react-aria-components"

import { cn } from "@/lib/utils"
import { ChevronRightIcon, CheckIcon } from "lucide-react"

/**
 * BoardUI (React Aria Components) 后端的 ContextMenu 复合 API。
 * RAC 无右键菜单原语：Root 维护 open 状态 + 光标坐标，Trigger 克隆
 * 消费方元素注入 onContextMenu，Content 以 portal 定位渲染 AriaMenu。
 * 已知降级（相对 Base UI）：子菜单为 hover 展开、无跨菜单方向键联动。
 */

interface ContextMenuState {
  menuId: string
  isOpen: boolean
  openAt: (x: number, y: number) => void
  close: () => void
  coords: { x: number; y: number }
  /** 子菜单：当前展开链（祖先→后代），祖先保持 open 以支持嵌套展开 */
  openSubPath: string[]
  openSub: (id: string, parentId: string | null) => void
  scheduleSubClose: (id: string) => void
  cancelPendingSubClose: () => void
}

const ContextMenuCtx = React.createContext<ContextMenuState>({
  menuId: "",
  isOpen: false,
  openAt: () => {},
  close: () => {},
  coords: { x: 0, y: 0 },
  openSubPath: [],
  openSub: () => {},
  scheduleSubClose: () => {},
  cancelPendingSubClose: () => {},
})

/** Sub 在父 SubContent 内注册父 id，支持兄弟互斥 + 祖先链保持展开 */
const SubParentCtx = React.createContext<string | null>(null)

let subIdCounter = 0

function ContextMenu({
  children,
  ...props
}: {
  children?: React.ReactNode
  [key: string]: unknown
}) {
  const menuId = React.useId()
  const [isOpen, setIsOpen] = React.useState(false)
  const [coords, setCoords] = React.useState({ x: 0, y: 0 })
  const [openSubPath, setOpenSubPath] = React.useState<string[]>([])
  const pendingCloseRef = React.useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null)
  const cancelPendingSubClose = React.useCallback(() => {
    if (pendingCloseRef.current) {
      clearTimeout(pendingCloseRef.current.timer)
      pendingCloseRef.current = null
    }
  }, [])
  React.useEffect(() => cancelPendingSubClose, [cancelPendingSubClose])
  const openSub = React.useCallback((id: string, parentId: string | null) => {
    cancelPendingSubClose()
    setOpenSubPath((cur) => {
      if (cur.includes(id)) return cur
      // 截断到父级（兄弟互斥），再 append 自己；祖先链保持展开
      const idx = parentId ? cur.indexOf(parentId) : -1
      const base = idx >= 0 ? cur.slice(0, idx + 1) : []
      return [...base, id]
    })
  }, [cancelPendingSubClose])
  const scheduleSubClose = React.useCallback(
    (id: string) => {
      cancelPendingSubClose()
      pendingCloseRef.current = {
        id,
        timer: setTimeout(() => {
          pendingCloseRef.current = null
          setOpenSubPath((cur) => {
            const idx = cur.indexOf(id)
            return idx >= 0 ? cur.slice(0, idx) : cur
          })
        }, 120),
      }
    },
    [cancelPendingSubClose],
  )
  const close = React.useCallback(() => {
    cancelPendingSubClose()
    setIsOpen(false)
    setOpenSubPath([])
  }, [cancelPendingSubClose])
  const openAt = React.useCallback(
    (x: number, y: number) => {
      cancelPendingSubClose()
      setCoords({ x, y })
      setOpenSubPath([])
      setIsOpen(true)
    },
    [cancelPendingSubClose],
  )
  const state = React.useMemo<ContextMenuState>(
    () => ({
      menuId,
      isOpen,
      openAt,
      close,
      coords,
      openSubPath,
      openSub,
      scheduleSubClose,
      cancelPendingSubClose,
    }),
    [menuId, isOpen, openAt, close, coords, openSubPath, openSub, scheduleSubClose, cancelPendingSubClose],
  )
  void props
  return <ContextMenuCtx value={state}>{children}</ContextMenuCtx>
}

function ContextMenuPortal({
  children,
  ...props
}: {
  children?: React.ReactNode
  [key: string]: unknown
}) {
  void props
  return <>{children}</>
}

function ContextMenuTrigger({
  render,
  className,
  children,
  ...props
}: {
  /** Base UI 兼容：render 元素/函数作为触发元素，被 clone 合并 onContextMenu/className/children。 */
  render?: React.ReactElement | ((triggerProps: Record<string, unknown>) => React.ReactElement)
  className?: string
  children?: React.ReactNode
  [key: string]: unknown
}) {
  const { openAt } = React.useContext(ContextMenuCtx)
  const handler = (e: React.MouseEvent) => {
    e.preventDefault()
    openAt(e.clientX, e.clientY)
  }
  // Base UI 等价语义：render 提供的元素就是触发容器（如画布 div），
  // clone 合并 context menu 行为；children（ReactFlow 等）挂进去。
  if (render !== undefined) {
    const attach = (element: React.ReactElement) => {
      const own = (element.props ?? {}) as {
        className?: string
        children?: React.ReactNode
        onContextMenu?: (e: React.MouseEvent) => void
      }
      return React.cloneElement(element, {
        ...props,
        className: cn(className, own.className),
        onContextMenu: (e: React.MouseEvent) => {
          own.onContextMenu?.(e)
          if (!e.defaultPrevented) handler(e)
        },
        children: children !== undefined ? children : own.children,
      } as Record<string, unknown>)
    }
    if (typeof render === "function") {
      return attach(render({ ...props, className, children: children as unknown }))
    }
    return attach(render)
  }
  const items = React.Children.toArray(children)
  if (items.length === 1 && React.isValidElement(items[0])) {
    const own = items[0] as React.ReactElement<{
      className?: string
      onContextMenu?: (e: React.MouseEvent) => void
    }>
    return React.cloneElement(
      own,
      {
        ...props,
        className: cn("select-none", className, own.props.className),
        onContextMenu: (e: React.MouseEvent) => {
          own.props.onContextMenu?.(e)
          if (!e.defaultPrevented) handler(e)
        },
      } as Record<string, unknown>,
    )
  }
  return (
    <div className={cn("select-none", className)} onContextMenu={handler} {...props}>
      {children}
    </div>
  )
}

const MENU_SURFACE =
  "z-110 max-h-[calc(100vh-24px)] min-w-36 overflow-x-hidden overflow-y-auto rounded-2xl border border-border-button-default bg-background-primary-default p-1 text-text-primary shadow-dropdown duration-100 outline-none"

function ContextMenuContent({
  className,
  children,
  ...props
}: {
  className?: string
  children?: React.ReactNode
  [key: string]: unknown
}) {
  const { menuId, isOpen, close, coords } = React.useContext(ContextMenuCtx)

  React.useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (e: PointerEvent) => {
      // 子菜单通过 Portal 挂到 body，所有层级按同一个菜单归属判断内部点击。
      const owner = e.target instanceof Element
        ? e.target.closest("[data-context-menu-owner]")?.getAttribute("data-context-menu-owner")
        : null
      if (owner !== menuId) close()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    document.addEventListener("pointerdown", onPointerDown, true)
    document.addEventListener("keydown", onKeyDown, true)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true)
      document.removeEventListener("keydown", onKeyDown, true)
    }
  }, [menuId, isOpen, close])

  if (!isOpen || typeof document === "undefined") return null
  return createPortal(
    <div
      data-context-menu-owner={menuId}
      style={{ position: "fixed", left: coords.x, top: coords.y, zIndex: 110 }}
    >
      <AriaMenu
        data-slot="context-menu-content"
        className={cn(MENU_SURFACE, className)}
        {...props}
      >
        {children}
      </AriaMenu>
    </div>,
    document.body,
  )
}

function ContextMenuGroup({
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
      data-slot="context-menu-group"
      className={cn("outline-none", className)}
    >
      {children}
    </AriaMenuSection>
  )
}

function ContextMenuLabel({
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
      data-slot="context-menu-label"
      data-inset={inset}
      className={cn(
        "px-1.5 py-1 text-xs font-medium text-text-secondary data-inset:pl-7",
        className,
      )}
      {...props}
    />
  )
}

function ContextMenuItem({
  className,
  inset,
  variant = "default",
  onClick,
  disabled,
  ...props
}: {
  inset?: boolean
  variant?: "default" | "destructive"
  onClick?: () => void
  disabled?: boolean
  className?: string
  [key: string]: unknown
}) {
  const { close } = React.useContext(ContextMenuCtx)
  return (
    <AriaMenuItem
      data-slot="context-menu-item"
      data-inset={inset}
      data-variant={variant}
      isDisabled={disabled}
      onAction={() => {
        onClick?.()
        close()
      }}
      className={cn(
        "group/context-menu-item relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-dropdown-item-hover-background data-inset:pl-7 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-background-tertiary-error data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[variant=destructive]:*:[svg]:text-destructive",
        className,
      )}
      {...props}
    />
  )
}

function ContextMenuSub({
  children,
  ...props
}: {
  children?: React.ReactNode
  [key: string]: unknown
}) {
  const id = React.useMemo(() => `ctx-sub-${++subIdCounter}`, [])
  const parentId = React.useContext(SubParentCtx)
  const { menuId, openSubPath, openSub, scheduleSubClose, cancelPendingSubClose } =
    React.useContext(ContextMenuCtx)
  const open = openSubPath.includes(id)
  const [anchor, setAnchor] = React.useState<{ top: number; left: number } | null>(null)
  const items = React.Children.toArray(children).filter(React.isValidElement)
  const trigger = items.find((i) => i.type === ContextMenuSubTrigger)
  const content = items.find((i) => i.type === ContextMenuSubContent)
  const rest = items.filter((i) => i !== trigger && i !== content)
  void props
  // RAC Menu 的 collection 会丢弃非 collection 子节点（div 包装整棵子树不显示），
  // 因此 Sub 不能用包装元素：trigger 直接留在父 Menu 的 collection 里，
  // content 悬浮时 portal 到 body 定位在 trigger 右侧。嵌套 Sub 靠
  // openSubPath 祖先链保持展开 + SubParentCtx 兄弟互斥递归成立。
  const anchoredTrigger = trigger
    ? React.cloneElement(
        trigger as React.ReactElement<Record<string, unknown>>,
        {
          onMouseEnter: (e: React.MouseEvent) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            setAnchor({ top: rect.top, left: rect.right })
            openSub(id, parentId)
          },
          onMouseLeave: () => scheduleSubClose(id),
        } as Record<string, unknown>,
      )
    : trigger
  return (
    <>
      {anchoredTrigger}
      {open && anchor && content && typeof document !== "undefined"
        ? createPortal(
            <div
              data-slot="context-menu-sub-popover"
              data-context-menu-owner={menuId}
              style={{ position: "fixed", top: anchor.top, left: anchor.left + 4, zIndex: 110 }}
              onMouseEnter={cancelPendingSubClose}
              onMouseLeave={() => scheduleSubClose(id)}
            >
              <SubParentCtx value={id}>{content}</SubParentCtx>
            </div>,
            document.body,
          )
        : null}
      {rest}
    </>
  )
}

function ContextMenuSubTrigger({
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
      data-slot="context-menu-sub-trigger"
      data-inset={inset}
      isDisabled={disabled}
      className={cn(
        "flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-dropdown-item-hover-background data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto" />
    </AriaMenuItem>
  )
}

function ContextMenuSubContent({
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
    <div
      data-slot="context-menu-sub-content"
      className="absolute top-0 left-full z-110 min-w-32 pt-0.5"
    >
      <AriaMenu className={cn(MENU_SURFACE, "min-w-32", className)}>
        {children}
      </AriaMenu>
    </div>
  )
}

function ContextMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  onClick,
  disabled,
  ...props
}: {
  checked?: boolean | "indeterminate"
  inset?: boolean
  onClick?: () => void
  disabled?: boolean
  className?: string
  children?: React.ReactNode
  [key: string]: unknown
}) {
  const onCheckedChange = props.onCheckedChange as
    | ((checked: boolean) => void)
    | undefined
  return (
    <AriaMenuItem
      data-slot="context-menu-checkbox-item"
      data-inset={inset}
      isDisabled={disabled}
      onAction={() => {
        onClick?.()
        onCheckedChange?.(!checked)
      }}
      className={cn(
        "relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-dropdown-item-hover-background data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...(props as Record<string, unknown>)}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="context-menu-checkbox-item-indicator"
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

function ContextMenuRadioGroup({
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
        data-slot="context-menu-radio-group"
        className="outline-none"
      >
        {children}
      </AriaMenuSection>
    </RadioGroupCtx>
  )
}

function ContextMenuRadioItem({
  className,
  children,
  inset,
  value,
  onClick,
  disabled,
  ...props
}: {
  value?: string
  inset?: boolean
  onClick?: () => void
  disabled?: boolean
  className?: string
  children?: React.ReactNode
  [key: string]: unknown
}) {
  const group = React.useContext(RadioGroupCtx)
  return (
    <AriaMenuItem
      data-slot="context-menu-radio-item"
      data-inset={inset}
      isDisabled={disabled}
      onAction={() => {
        onClick?.()
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
        data-slot="context-menu-radio-item-indicator"
      >
        {group.value !== undefined && value === group.value ? (
          <CheckIcon />
        ) : null}
      </span>
      {children}
    </AriaMenuItem>
  )
}

function ContextMenuSeparator({
  className,
  ...props
}: {
  className?: string
  [key: string]: unknown
}) {
  return (
    <AriaSeparator
      data-slot="context-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-separator-border", className)}
      {...props}
    />
  )
}

function ContextMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="context-menu-shortcut"
      className={cn(
        "ms-auto font-medium font-sans text-xs tracking-widest text-text-secondary",
        className,
      )}
      {...props}
    />
  )
}

export {
  ContextMenu,
  ContextMenuPortal,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuLabel,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
}
