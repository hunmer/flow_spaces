"use client"

// Mini App 运行时兼容层：存量 Mini App 经 @flow-spaces/ui / window.AgentSpacesUI
// 消费 Tabs/TabsList/TabsTrigger/TabsContent 的 shadcn API 表面（lib/ui-exports.ts 再导出）。
// 业务代码请改用 @/components/base/tabs；此文件仅为 Mini App 平台契约保留。

import {
  Tabs as AriaTabs,
  TabList as AriaTabList,
  Tab as AriaTab,
  TabPanel as AriaTabPanel,
} from "react-aria-components"
import type {
  TabListProps as AriaTabListProps,
  TabPanelProps as AriaTabPanelProps,
  TabProps as AriaTabProps,
  TabsProps as AriaTabsProps,
} from "react-aria-components"
import { cva, type VariantProps } from "class-variance-authority"

import { cx } from "@/utils/cx"

/**
 * RAC 的 className 允许是 (renderProps) => string 渲染函数，而 cx() 只接受
 * 字符串值。函数式 className 视为消费方完全接管样式，原样透传给 RAC；
 * 字符串则与基类合并。
 */
function mergeClassName<T>(
  base: string,
  className: string | ((state: T) => string) | undefined
) {
  return typeof className === "function" ? className : cx(base, className)
}

/**
 * cossui → BoardUI 迁移适配层（React Aria Tabs 后端）。
 *
 * 对外保持 Base UI Tabs 的复合 API 与导出名：
 *   Tabs(value/defaultValue/onValueChange)
 *     → AriaTabs(selectedKey/defaultSelectedKey/onSelectionChange)
 *   TabsTrigger/TabsContent(value) → AriaTab/AriaTabPanel(id)
 *
 * 保留 data-active 属性镜像（Base UI 语义）：部分消费方样式用了
 * data-[active]: 选择器，RAC 原生只输出 data-selected，这里用
 * MutationObserver 把 data-selected 同步为 data-active，消费方零改动。
 */

function Tabs({
  className,
  value,
  defaultValue,
  onValueChange,
  ...props
}: Omit<AriaTabsProps, "selectedKey" | "defaultSelectedKey" | "onSelectionChange"> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}) {
  return (
    <AriaTabs
      data-slot="tabs"
      selectedKey={value}
      defaultSelectedKey={defaultValue}
      onSelectionChange={(key) => onValueChange?.(String(key))}
      className={mergeClassName(
        "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-text-secondary group-data-[orientation=horizontal]/tabs:h-8 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-background-tertiary-default",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: AriaTabListProps<object> & VariantProps<typeof tabsListVariants>) {
  return (
    <AriaTabList
      data-slot="tabs-list"
      data-variant={variant}
      className={mergeClassName(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

/** 把 RAC 的 data-selected 镜像为 Base UI 时代的 data-active 属性。 */
function useActiveAttributeMirror() {
  return (el: HTMLElement | null) => {
    if (!el) return
    const sync = () => {
      if (el.hasAttribute("data-selected")) el.setAttribute("data-active", "")
      else el.removeAttribute("data-active")
    }
    sync()
    const mo = new MutationObserver(sync)
    mo.observe(el, { attributeFilter: ["data-selected"] })
  }
}

function TabsTrigger({ className, value, ...props }: Omit<AriaTabProps, "id"> & { value: string }) {
  const mirror = useActiveAttributeMirror()
  return (
    <AriaTab
      id={value}
      data-slot="tabs-trigger"
      ref={mirror}
      className={mergeClassName(
        cx(
          "relative inline-flex h-[calc(100%-1px)] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-body-medium whitespace-nowrap text-text-secondary transition-all",
          "outline-none focus-visible:border-border-focus-ring focus-visible:ring-2 focus-visible:ring-border-focus-ring",
          "hover:text-text-primary",
          "group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start",
          "data-disabled:pointer-events-none data-disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
          "has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1",
          "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          "data-selected:bg-background-primary-default data-selected:text-text-primary data-selected:shadow-sm",
          "group-data-[variant=default]/tabs-list:data-selected:shadow-sm",
          "group-data-[variant=line]/tabs-list:data-selected:bg-transparent group-data-[variant=line]/tabs-list:data-selected:shadow-none",
          "after:absolute after:bg-accent-600 after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-selected:after:opacity-100"
        ),
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, value, ...props }: Omit<AriaTabPanelProps, "id"> & { value: string }) {
  return (
    <AriaTabPanel
      id={value}
      data-slot="tabs-content"
      className={mergeClassName("flex-1 text-body-regular outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
