"use client"

import * as React from "react"
import { cx } from "@/utils/cx"
import type { RenderProp } from "@/components/ui/use-render"

/**
 * Collapsible — local implementation replacing the Base UI collapsible.
 * Same composite API: <Collapsible open defaultOpen onOpenChange> with
 * CollapsibleTrigger (button; supports `render`), CollapsibleTriggerAsChild
 * (clones its child element into a trigger) and CollapsibleContent (div,
 * `hidden` + data-state while closed so exit animations still apply).
 */

interface CollapsibleContextValue {
  open: boolean
  toggle: () => void
}

const CollapsibleContext = React.createContext<CollapsibleContextValue | null>(null)

function useCollapsibleContext(componentName: string): CollapsibleContextValue {
  const ctx = React.useContext(CollapsibleContext)
  if (!ctx) {
    throw new Error(`${componentName} must be rendered inside <Collapsible>`)
  }
  return ctx
}

export type CollapsibleProps = Omit<
  React.ComponentProps<"div">,
  "open" | "onOpenChange" | "defaultValue" | "ref"
> & {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

function Collapsible({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  className,
  children,
  ...wrapperProps
}: CollapsibleProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const toggle = React.useCallback(() => {
    const next = !open
    if (!isControlled) {
      setUncontrolledOpen(next)
    }
    onOpenChange?.(next)
  }, [open, isControlled, onOpenChange])

  const value = React.useMemo(() => ({ open, toggle }), [open, toggle])

  return (
    <CollapsibleContext.Provider value={value}>
      <div
        data-state={open ? "open" : "closed"}
        data-slot="collapsible"
        className={className}
        {...wrapperProps}
      >
        {children}
      </div>
    </CollapsibleContext.Provider>
  )
}

export type CollapsibleTriggerProps = Omit<
  React.ComponentProps<"button">,
  "render"
> & {
  render?: RenderProp
}

function CollapsibleTrigger({
  onClick,
  render,
  ...props
}: CollapsibleTriggerProps) {
  const { open, toggle } = useCollapsibleContext("CollapsibleTrigger")

  const triggerProps = {
    ...props,
    "aria-expanded": open,
    "data-state": open ? "open" : "closed",
    "data-slot": "collapsible-trigger",
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event)
      if (!event.defaultPrevented) {
        toggle()
      }
    },
  } as React.ComponentProps<"button">

  if (render == null) {
    return <button type="button" {...triggerProps} />
  }
  if (typeof render === "function") {
    return render(triggerProps as Record<string, unknown>)
  }
  const element = render as React.ReactElement<Record<string, any>>
  const { children: elementChildren, ...restElementProps } = element.props ?? {}
  const merged = {
    ...restElementProps,
    ...triggerProps,
    className: cx(restElementProps.className, triggerProps.className),
  }
  if (elementChildren !== undefined && merged.children === undefined) {
    merged.children = elementChildren
  }
  return React.cloneElement(element, merged)
}

function CollapsibleTriggerAsChild({
  children,
  ...props
}: Omit<CollapsibleTriggerProps, "render" | "children"> & {
  children: React.ReactElement
}) {
  return <CollapsibleTrigger render={children} {...props} />
}

export type CollapsibleContentProps = React.ComponentProps<"div"> & {
  keepMounted?: boolean
}

function CollapsibleContent({
  className,
  children,
  keepMounted = true,
  ...props
}: CollapsibleContentProps) {
  const { open } = useCollapsibleContext("CollapsibleContent")

  if (!open && !keepMounted) {
    return null
  }

  return (
    <div
      hidden={!open}
      data-state={open ? "open" : "closed"}
      data-slot="collapsible-content"
      className={className}
      {...props}
    >
      {children}
    </div>
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleTriggerAsChild, CollapsibleContent }
