"use client"

import * as React from "react"
import {
  Heading as AriaHeading,
  Modal as AriaModal,
  ModalOverlay as AriaModalOverlay,
  Text as AriaText,
} from "react-aria-components"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useMobilePanelStore } from "@/stores/mobile-panel"

/**
 * BoardUI (React Aria Components) 后端的 AlertDialog 复合 API。
 * 保持原 Base UI 版本的导出名与 props 形态；useMobilePanelStore
 * registerOverlay 的 Android 返回键集成逐条保留。
 * AlertDialogPortal/Overlay 为兼容包装（portal 与遮罩由 ModalOverlay 自带）。
 */

interface AlertDialogState {
  isOpen: boolean
  open: () => void
  close: () => void
}

const AlertDialogCtx = React.createContext<AlertDialogState>({
  isOpen: false,
  open: () => {},
  close: () => {},
})

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

function AlertDialog({
  ignoreBack = false,
  open,
  onOpenChange,
  defaultOpen,
  children,
  ...props
}: {
  ignoreBack?: boolean
  open?: boolean
  onOpenChange?: (open: boolean, ...rest: unknown[]) => void
  defaultOpen?: boolean
  children?: React.ReactNode
  [key: string]: unknown
}) {
  const overlayId = React.useId()
  const registerOverlay = useMobilePanelStore((state) => state.registerOverlay)
  const unregisterOverlay = useMobilePanelStore((state) => state.unregisterOverlay)

  const [innerOpen, setInnerOpen] = React.useState(Boolean(defaultOpen))
  const isOpen = open ?? innerOpen
  const set = React.useCallback(
    (next: boolean) => {
      setInnerOpen(next)
      onOpenChange?.(next)
    },
    [onOpenChange],
  )
  const state = React.useMemo<AlertDialogState>(
    () => ({ isOpen, open: () => set(true), close: () => set(false) }),
    [isOpen, set],
  )

  const onOpenChangeRef = React.useRef(onOpenChange)
  React.useEffect(() => {
    onOpenChangeRef.current = onOpenChange
  }, [onOpenChange])

  React.useEffect(() => {
    if (!isOpen || ignoreBack || !onOpenChangeRef.current) {
      unregisterOverlay(overlayId)
      return
    }
    registerOverlay(overlayId, () => onOpenChangeRef.current?.(false))
    return () => unregisterOverlay(overlayId)
  }, [ignoreBack, isOpen, overlayId, registerOverlay, unregisterOverlay])

  void props
  return <AlertDialogCtx value={state}>{children}</AlertDialogCtx>
}

function AlertDialogTrigger({
  render,
  ...rest
}: {
  render?: React.ReactElement
  [key: string]: unknown
}) {
  const { open } = React.useContext(AlertDialogCtx)
  return renderWith(render ?? <button type="button" />, {
    ...rest,
    onClick: open,
  })
}

function AlertDialogPortal({
  children,
  ...props
}: {
  children?: React.ReactNode
  [key: string]: unknown
}) {
  void props
  return <>{children}</>
}

function AlertDialogOverlay({
  className,
  ...props
}: {
  className?: string
  [key: string]: unknown
}): null {
  void className
  void props
  return null
}

function AlertDialogContent({
  className,
  size = "default",
  ...props
}: {
  size?: "default" | "sm"
  className?: string
  children?: React.ReactNode
  [key: string]: unknown
}) {
  const { isOpen, close } = React.useContext(AlertDialogCtx)
  return (
    <AriaModalOverlay
      isDismissable
      isOpen={isOpen}
      onOpenChange={(next) => {
        if (!next) close()
      }}
      className="fixed inset-0 isolate z-100 bg-black/70 outline-none backdrop-blur-xs duration-100"
    >
      <AriaModal
        data-size={size}
        className={cn(
          "group/alert-dialog-content absolute top-1/2 left-1/2 grid w-full -translate-x-1/2 -translate-y-1/2 gap-4 rounded-3xl border border-separator-border bg-background-full p-4 text-text-primary shadow-xs duration-100 outline-none data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-sm transition-[opacity,scale] data-[entering]:opacity-0 data-[entering]:scale-95 data-[exiting]:opacity-0 data-[exiting]:scale-95",
          className,
        )}
        {...props}
      />
    </AriaModalOverlay>
  )
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn(
        "grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-4 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]",
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-3xl border-t border-separator-border bg-background-secondary-default/50 p-4 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogMedia({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-media"
      className={cn(
        "mb-2 inline-flex size-10 items-center justify-center rounded-xl bg-background-tertiary-default sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-6",
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogTitle({
  className,
  ...props
}: {
  className?: string
  [key: string]: unknown
}) {
  return (
    <AriaHeading
      slot="title"
      data-slot="alert-dialog-title"
      className={cn(
        "text-title-3-medium text-text-primary sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2",
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: {
  className?: string
  [key: string]: unknown
}) {
  return (
    <AriaText
      slot="description"
      data-slot="alert-dialog-description"
      className={cn(
        "text-sm text-balance text-text-secondary md:text-pretty *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-text-primary",
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogAction({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { close } = React.useContext(AlertDialogCtx)
  return (
    <Button
      data-slot="alert-dialog-action"
      className={cn(className)}
      onClick={(...args: Parameters<NonNullable<React.ComponentProps<typeof Button>["onClick"]>>) => {
        onClick?.(...args)
        close()
      }}
      {...props}
    />
  )
}

function AlertDialogCancel({
  className,
  variant = "outline",
  size = "default",
  onClick,
  ...props
}: {
  variant?: React.ComponentProps<typeof Button>["variant"]
  size?: React.ComponentProps<typeof Button>["size"]
} & Omit<React.ComponentProps<typeof Button>, "variant" | "size">) {
  const { close } = React.useContext(AlertDialogCtx)
  return (
    <Button
      data-slot="alert-dialog-cancel"
      variant={variant}
      size={size}
      className={cn(className)}
      onClick={(...args: Parameters<NonNullable<React.ComponentProps<typeof Button>["onClick"]>>) => {
        onClick?.(...args)
        close()
      }}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogMedia,
}
