"use client"

import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { ChevronDownIcon } from "lucide-react"

/**
 * BoardUI token 风格的最小 NavigationMenu 实现（原 Base UI 后端移除）。
 * 当前无业务消费方（仅 ui-exports.ts 再导出），采用受控简单实现：
 * Root 维护 openValue；Trigger 切换；Content 在所属 Item 下拉渲染。
 */

interface NavMenuState {
  openValue: string | null
  setOpenValue: (v: string | null) => void
}

const NavMenuCtx = React.createContext<NavMenuState>({
  openValue: null,
  setOpenValue: () => {},
})

let navItemCounter = 0

function NavigationMenu({
  align: _align,
  className,
  children,
  ...props
}: {
  align?: "start" | "center" | "end"
  className?: string
  children?: React.ReactNode
  [key: string]: unknown
}) {
  void _align
  const [openValue, setOpenValue] = React.useState<string | null>(null)
  const state = React.useMemo(() => ({ openValue, setOpenValue }), [openValue])
  return (
    <nav
      data-slot="navigation-menu"
      className={cn(
        "group/navigation-menu relative flex max-w-max flex-1 items-center justify-center",
        className,
      )}
      {...props}
    >
      <NavMenuCtx value={state}>{children}</NavMenuCtx>
    </nav>
  )
}

function NavigationMenuList({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="navigation-menu-list"
      className={cn(
        "group flex flex-1 list-none items-center justify-center gap-0",
        className,
      )}
      {...props}
    />
  )
}

const ItemCtx = React.createContext<{ value: string }>({ value: "" })

function NavigationMenuItem({
  className,
  children,
  ...props
}: React.ComponentProps<"li">) {
  const value = React.useMemo(() => `nav-item-${++navItemCounter}`, [])
  const items = React.Children.toArray(children).filter(React.isValidElement)
  const trigger = items.find((i) => i.type === NavigationMenuTrigger)
  const rest = items.filter((i) => i !== trigger)
  return (
    <ItemCtx value={{ value }}>
      <li
        data-slot="navigation-menu-item"
        className={cn("relative", className)}
        {...props}
      >
        {trigger}
        {rest}
      </li>
    </ItemCtx>
  )
}

const navigationMenuTriggerStyle = cva(
  "group/navigation-menu-trigger inline-flex h-9 w-max items-center justify-center rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all outline-none hover:bg-background-tertiary-default focus:bg-background-tertiary-default focus-visible:ring-3 focus-visible:ring-border-focus-ring focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-popup-open:bg-background-secondary-default data-popup-open:hover:bg-background-tertiary-default data-open:bg-background-secondary-default data-open:hover:bg-background-tertiary-default data-open:focus:bg-background-tertiary-default",
)

function NavigationMenuTrigger({
  className,
  children,
  onClick,
  ...props
}: React.ComponentProps<"button">) {
  const { value } = React.useContext(ItemCtx)
  const { openValue, setOpenValue } = React.useContext(NavMenuCtx)
  const open = openValue === value
  return (
    <button
      type="button"
      data-slot="navigation-menu-trigger"
      data-state={open ? "open" : "closed"}
      className={cn(navigationMenuTriggerStyle(), "group", className)}
      onClick={(e) => {
        onClick?.(e)
        if (!e.defaultPrevented) setOpenValue(open ? null : value)
      }}
      {...props}
    >
      {children}{" "}
      <ChevronDownIcon
        className="relative top-px ml-1 size-3 transition duration-300 group-data-open/navigation-menu-trigger:rotate-180"
        aria-hidden="true"
      />
    </button>
  )
}

function NavigationMenuContent({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const { value } = React.useContext(ItemCtx)
  const { openValue } = React.useContext(NavMenuCtx)
  if (openValue !== value) return null
  return (
    <div
      data-slot="navigation-menu-content"
      className={cn(
        "absolute top-full left-0 z-110 mt-2 w-max rounded-2xl border border-border-button-default bg-background-primary-default p-1 text-text-primary shadow-dropdown duration-300 data-[entering]:animate-in data-[entering]:fade-in-0 data-[entering]:zoom-in-95",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function NavigationMenuPositioner({
  className,
  children,
  ...props
}: {
  className?: string
  children?: React.ReactNode
  [key: string]: unknown
}) {
  void className
  void props
  return <>{children}</>
}

function NavigationMenuLink({
  className,
  ...props
}: React.ComponentProps<"a">) {
  return (
    <a
      data-slot="navigation-menu-link"
      className={cn(
        "flex items-center gap-2 rounded-lg p-2 text-sm transition-all outline-none hover:bg-background-tertiary-default focus:bg-background-tertiary-default focus-visible:ring-3 focus-visible:ring-border-focus-ring focus-visible:outline-1 in-data-[slot=navigation-menu-content]:rounded-md data-active:bg-background-secondary-default data-active:hover:bg-background-tertiary-default data-active:focus:bg-background-tertiary-default [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  )
}

function NavigationMenuIndicator({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="navigation-menu-indicator"
      className={cn(
        "top-full z-1 hidden h-1.5 items-end justify-center overflow-hidden",
        className,
      )}
      {...props}
    >
      <div className="relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm bg-separator-border shadow-md" />
    </div>
  )
}

export {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
  NavigationMenuPositioner,
}
