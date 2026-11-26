"use client"

import * as React from "react"
import { mergeProps, useRender } from "@/components/ui/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cx } from "@/utils/cx"
import { Focusable } from "react-aria-components"
// BoardUI 迁移：skeleton / tooltip 改用 base 版本（保留本组件其余结构）
import { Skeleton } from "@/components/base/skeleton/skeleton"
import {
  Tooltip,
  TooltipTrigger,
} from "@/components/base/tooltip/tooltip"
import { useSidebar } from "@/components/ui/sidebar-context"

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cx("flex w-full min-w-0 flex-col gap-0", className)}
      {...props}
    />
  )
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cx("group/menu-item relative", className)}
      {...props}
    />
  )
}

const sidebarMenuButtonVariants = cva(
  "peer/menu-button group/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm ring-border-focus-ring outline-hidden transition-[width,height,padding] group-has-data-[sidebar=menu-action]/menu-item:pr-8 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! hover:bg-background-primary-hover hover:text-text-primary focus-visible:ring-2 active:bg-background-primary-active active:text-text-primary disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-open:hover:bg-background-primary-hover data-open:hover:text-text-primary data-active:bg-background-tertiary-default data-active:font-medium data-active:text-text-primary [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate",
  {
    variants: {
      variant: {
        default: "hover:bg-background-primary-hover hover:text-text-primary",
        outline:
          "bg-background-primary-default border border-separator-border hover:bg-background-primary-hover hover:text-text-primary hover:border-border-button-hover",
      },
      size: {
        default: "h-8 text-sm",
        sm: "h-7 text-xs",
        lg: "h-12 text-sm group-data-[collapsible=icon]:p-0!",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function SidebarMenuButton({
  render,
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  className,
  ...props
}: useRender.ComponentProps<"button"> &
  React.ComponentProps<"button"> & {
    isActive?: boolean
    tooltip?: string | React.ComponentProps<typeof Tooltip>
  } & VariantProps<typeof sidebarMenuButtonVariants>) {
  const { isMobile, state } = useSidebar()
  const comp = useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: cx(sidebarMenuButtonVariants({ variant, size }), className),
      },
      props
    ),
    render,
    state: {
      slot: "sidebar-menu-button",
      sidebar: "menu-button",
      size,
      active: isActive,
    },
  })

  if (!tooltip) {
    return comp
  }

  if (typeof tooltip === "string") {
    tooltip = {
      children: tooltip,
    }
  }

  return (
    // BoardUI 迁移：base tooltip 结构 = TooltipTrigger + Focusable 包 trigger 元素 + Tooltip。
    // comp 是 useRender 产出的最终元素（运行时为原生 button 或自定义 render，静态类型
    // 为 unknown props，故断言为可聚焦元素）；仅折叠且非移动端时挂载 tooltip（展开态
    // 按钮文字可见，无需 tooltip）。
    <TooltipTrigger>
      {/* comp 运行时是原生 button / 自定义元素；静态类型宽（unknown props），断言为
          Focusable 接受的 DOM 元素形态（never 对 props/type 均为底类型，结构兼容） */}
      <Focusable>{comp as React.ReactElement<never, never>}</Focusable>
      {state === "collapsed" && !isMobile ? (
        <Tooltip placement="right" {...tooltip} />
      ) : null}
    </TooltipTrigger>
  )
}

function SidebarMenuAction({
  className,
  render,
  showOnHover = false,
  ...props
}: useRender.ComponentProps<"button"> &
  React.ComponentProps<"button"> & {
    showOnHover?: boolean
  }) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: cx(
          "absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-text-primary ring-border-focus-ring outline-hidden transition-transform group-data-[collapsible=icon]:hidden peer-hover/menu-button:text-text-primary peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 peer-data-[size=sm]/menu-button:top-1 after:absolute after:-inset-2 hover:bg-background-primary-hover hover:text-text-primary focus-visible:ring-2 md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0",
          showOnHover &&
            "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 peer-data-active/menu-button:text-text-primary aria-expanded:opacity-100 md:opacity-0",
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "sidebar-menu-action",
      sidebar: "menu-action",
    },
  })
}

function SidebarMenuBadge({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={cx(
        "pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium text-text-primary tabular-nums select-none group-data-[collapsible=icon]:hidden peer-hover/menu-button:text-text-primary peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 peer-data-[size=sm]/menu-button:top-1 peer-data-active/menu-button:text-text-primary",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: React.ComponentProps<"div"> & {
  showIcon?: boolean
}) {
  // Random width between 50 to 90%.
  const [width] = React.useState(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`
  })

  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cx("flex h-8 items-center gap-2 rounded-md px-2", className)}
      {...props}
    >
      {showIcon && (
        // BoardUI 迁移：base Skeleton（rect 默认圆角，外观遵循 base 官方；原 data-sidebar 钩子无样式引用，移除）
        <Skeleton className="size-4" />
      )}
      <Skeleton
        shape="text"
        className="h-4 max-w-(--skeleton-width) flex-1"
        style={
          {
            "--skeleton-width": width,
          } as React.CSSProperties
        }
      />
    </div>
  )
}

export {
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  sidebarMenuButtonVariants,
}
