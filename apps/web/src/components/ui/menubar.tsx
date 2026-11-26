"use client"

import * as React from "react"
import { MenuItem as AriaMenuItem } from "react-aria-components"

import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuRadioGroupCtx,
} from "@/components/ui/dropdown-menu"
import { CheckIcon } from "lucide-react"

/**
 * BoardUI (React Aria Components) 后端：Menubar 为普通 menubar 容器，
 * 各菜单子组件复用 ui/dropdown-menu 的 RAC 实现，导出名与 props 不变。
 * 注：RAC 无 MenuBar 原语，顶级菜单间的左右方向键切换降级为各菜单独立。
 */

function Menubar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="menubar"
      data-slot="menubar"
      className={cn(
        "flex h-8 items-center gap-0.5 rounded-lg border border-border-button-default bg-background-primary-default p-[3px]",
        className,
      )}
      {...props}
    />
  )
}

function MenubarMenu({ ...props }: React.ComponentProps<typeof DropdownMenu>) {
  return <DropdownMenu data-slot="menubar-menu" {...props} />
}

function MenubarGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuGroup>) {
  return <DropdownMenuGroup data-slot="menubar-group" {...props} />
}

function MenubarPortal({
  ...props
}: React.ComponentProps<typeof DropdownMenuPortal>) {
  return <DropdownMenuPortal data-slot="menubar-portal" {...props} />
}

function MenubarTrigger({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuTrigger>) {
  return (
    <DropdownMenuTrigger
      data-slot="menubar-trigger"
      className={cn(
        "flex items-center rounded-sm px-1.5 py-[2px] text-sm font-medium outline-hidden select-none hover:bg-background-tertiary-default aria-expanded:bg-background-tertiary-default",
        className,
      )}
      {...props}
    />
  )
}

function MenubarContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      data-slot="menubar-content"
      className={cn("min-w-36", className)}
      {...props}
    />
  )
}

function MenubarItem({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuItem>) {
  return (
    <DropdownMenuItem
      data-slot="menubar-item"
      className={cn(
        "group/menubar-item gap-1.5 rounded-md px-1.5 py-1 text-sm focus:bg-dropdown-item-hover-background data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-background-tertiary-error data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  )
}

function MenubarCheckboxItem({
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
      data-slot="menubar-checkbox-item"
      data-inset={inset}
      isDisabled={disabled}
      onAction={() => {
        onClick?.()
        onCheckedChange?.(!checked)
      }}
      className={cn(
        "relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-1.5 pl-7 text-sm outline-hidden select-none focus:bg-dropdown-item-hover-background data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-1.5 flex size-4 items-center justify-center [&_svg:not([class*='size-'])]:size-4">
        {checked ? <CheckIcon /> : null}
      </span>
      {children}
    </AriaMenuItem>
  )
}

function MenubarRadioGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuRadioGroup>) {
  return <DropdownMenuRadioGroup data-slot="menubar-radio-group" {...props} />
}

function MenubarRadioItem({
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
  const group = React.useContext(DropdownMenuRadioGroupCtx)
  return (
    <AriaMenuItem
      data-slot="menubar-radio-item"
      data-inset={inset}
      isDisabled={disabled}
      onAction={() => {
        onClick?.()
        if (value !== undefined) group.onValueChange?.(value)
      }}
      className={cn(
        "relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-1.5 pl-7 text-sm outline-hidden select-none focus:bg-dropdown-item-hover-background data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-1.5 flex size-4 items-center justify-center [&_svg:not([class*='size-'])]:size-4">
        {group.value !== undefined && value === group.value ? (
          <CheckIcon />
        ) : null}
      </span>
      {children}
    </AriaMenuItem>
  )
}

function MenubarLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuLabel> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuLabel
      data-slot="menubar-label"
      data-inset={inset}
      className={cn(
        "px-1.5 py-1 text-sm font-medium data-inset:pl-7",
        className,
      )}
      {...props}
    />
  )
}

function MenubarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuSeparator>) {
  return (
    <DropdownMenuSeparator
      data-slot="menubar-separator"
      className={cn("-mx-1 my-1 h-px bg-separator-border", className)}
      {...props}
    />
  )
}

function MenubarShortcut({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuShortcut>) {
  return (
    <DropdownMenuShortcut
      data-slot="menubar-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-text-secondary group-focus/menubar-item:text-text-primary",
        className,
      )}
      {...props}
    />
  )
}

function MenubarSub({
  ...props
}: React.ComponentProps<typeof DropdownMenuSub>) {
  return <DropdownMenuSub data-slot="menubar-sub" {...props} />
}

function MenubarSubTrigger({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuSubTrigger> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuSubTrigger
      data-slot="menubar-sub-trigger"
      data-inset={inset}
      className={cn(
        "gap-1.5 rounded-md px-1.5 py-1 text-sm focus:bg-dropdown-item-hover-background data-inset:pl-7 data-open:bg-dropdown-item-hover-background [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  )
}

function MenubarSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuSubContent>) {
  return (
    <DropdownMenuSubContent
      data-slot="menubar-sub-content"
      className={cn("min-w-32", className)}
      {...props}
    />
  )
}

export {
  Menubar,
  MenubarPortal,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarGroup,
  MenubarSeparator,
  MenubarLabel,
  MenubarItem,
  MenubarShortcut,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
}
