"use client";

import { SearchIcon } from "lucide-react";
import * as React from "react";
import {
  Dialog as AriaDialog,
  Modal as AriaModal,
  ModalOverlay as AriaModalOverlay,
} from "react-aria-components";
import { cx } from "@/utils/cx";
import {
  Autocomplete,
  AutocompleteCollection,
  AutocompleteEmpty,
  AutocompleteGroup,
  AutocompleteGroupLabel,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompleteSeparator,
} from "@/components/ui/autocomplete";

/**
 * BoardUI (React Aria Components) 后端的 Command Dialog。
 * 仅替换原 Base UI Dialog 后端为 AriaModalOverlay；Command 列表系
 * 仍是 ui/autocomplete 薄包装，props 形态不变。
 */

interface CommandDialogState {
  isOpen: boolean
  open: () => void
  close: () => void
}

const CommandDialogCtx = React.createContext<CommandDialogState>({
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
    className: cx(className, own.className),
    onClick: (e: React.MouseEvent) => {
      own.onClick?.(e)
      if (!e.defaultPrevented) onClick?.(e)
    },
    children: children !== undefined ? children : own.children,
  } as Record<string, unknown>)
}

function CommandDialog({
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
  const [innerOpen, setInnerOpen] = React.useState(Boolean(defaultOpen))
  const isOpen = open ?? innerOpen
  const set = React.useCallback(
    (next: boolean) => {
      setInnerOpen(next)
      onOpenChange?.(next)
    },
    [onOpenChange],
  )
  const state = React.useMemo<CommandDialogState>(
    () => ({ isOpen, open: () => set(true), close: () => set(false) }),
    [isOpen, set],
  )
  void props
  return <CommandDialogCtx value={state}>{children}</CommandDialogCtx>
}

function CommandDialogTrigger({
  render,
  ...rest
}: {
  render?: React.ReactElement
  [key: string]: unknown
}) {
  const { open } = React.useContext(CommandDialogCtx)
  return renderWith(render ?? <button type="button" />, {
    ...rest,
    onClick: open,
  })
}

function CommandDialogPortal({
  children,
  ...props
}: {
  children?: React.ReactNode
  [key: string]: unknown
}) {
  void props
  return <>{children}</>
}

/** 兼容再导出：Base UI createHandle 无 RAC 对应物，置为稳定空实现。 */
function commandCreateHandleStub(): null {
  return null
}
const CommandCreateHandle = commandCreateHandleStub as unknown as () => null

/** 兼置包装：遮罩由 AriaModalOverlay 自带。 */
function CommandDialogBackdrop({
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

function CommandDialogPopup({
  className,
  children,
  portalProps,
  ...props
}: {
  className?: string
  children?: React.ReactNode
  portalProps?: Record<string, unknown>
  [key: string]: unknown
}) {
  const { isOpen, close } = React.useContext(CommandDialogCtx)
  void portalProps
  return (
    <AriaModalOverlay
      isDismissable
      isOpen={isOpen}
      onOpenChange={(next) => {
        if (!next) close()
      }}
      className="fixed inset-0 z-100 bg-black/70 outline-none backdrop-blur-sm transition-opacity duration-200 data-[entering]:opacity-0 data-[exiting]:opacity-0"
    >
      <div className="fixed inset-0 flex flex-col items-center px-4 py-[max(--spacing(4),4vh)] sm:py-[10vh]">
        <AriaModal
          className={cx(
            "relative flex max-h-105 min-h-0 w-full min-w-0 max-w-xl flex-col rounded-3xl border border-border-button-default bg-background-primary-default text-text-primary shadow-sidebar outline-none transition-[scale,opacity,translate] duration-200 ease-in-out will-change-transform before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-3xl)-1px)] before:bg-background-secondary-default/72 data-[entering]:scale-98 data-[entering]:opacity-0 data-[exiting]:scale-98 data-[exiting]:opacity-0 **:data-[slot=scroll-area-viewport]:data-has-overflow-y:pe-1",
            className,
          )}
          data-slot="command-dialog-popup"
          {...props}
        >
          {/* RAC Modal 不透传 role/aria-modal；由 Dialog 提供 role=dialog */}
          <AriaDialog className="contents outline-none">{children}</AriaDialog>
        </AriaModal>
      </div>
    </AriaModalOverlay>
  )
}

export function Command({
  autoHighlight = "always",
  keepHighlight = true,
  ...props
}: React.ComponentProps<typeof Autocomplete>): React.ReactElement {
  return (
    <Autocomplete
      autoHighlight={autoHighlight}
      keepHighlight={keepHighlight}
      inline
      open
      {...props}
    />
  );
}

export function CommandInput({
  className,
  placeholder = undefined,
  ...props
}: React.ComponentProps<typeof AutocompleteInput>): React.ReactElement {
  return (
    <div className="px-2.5 py-1.5">
      <AutocompleteInput
        autoFocus
        className={cx(
          "border-transparent! bg-transparent! shadow-none before:hidden has-focus-visible:ring-0",
          className,
        )}
        placeholder={placeholder}
        size="lg"
        startAddon={<SearchIcon />}
        {...props}
      />
    </div>
  );
}

export function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof AutocompleteList>): React.ReactElement {
  return (
    <AutocompleteList
      className={cx("not-empty:scroll-py-2 not-empty:p-2", className)}
      data-slot="command-list"
      {...props}
    />
  );
}

export function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof AutocompleteEmpty>): React.ReactElement {
  return (
    <AutocompleteEmpty
      className={cx("not-empty:py-6", className)}
      data-slot="command-empty"
      {...props}
    />
  );
}

export function CommandPanel({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cx(
        "relative -mx-px not-has-[+[data-slot=command-footer]]:-mb-px min-h-0 rounded-t-xl not-has-[+[data-slot=command-footer]]:rounded-b-3xl border border-b-0 border-border-button-default bg-background-primary-default bg-clip-padding [clip-path:inset(0_1px)] not-has-[+[data-slot=command-footer]]:[clip-path:inset(0_1px_1px_1px_round_0_0_calc(var(--radius-3xl)-1px)_calc(var(--radius-3xl)-1px))] before:pointer-events-none before:absolute before:inset-0 before:rounded-t-[calc(var(--radius-xl)-1px)] **:data-[slot=scroll-area-scrollbar]:mt-2",
        className,
      )}
      {...props}
    />
  );
}

export function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof AutocompleteGroup>): React.ReactElement {
  return (
    <AutocompleteGroup
      className={className}
      data-slot="command-group"
      {...props}
    />
  );
}

export function CommandGroupLabel({
  className,
  ...props
}: React.ComponentProps<typeof AutocompleteGroupLabel>): React.ReactElement {
  return (
    <AutocompleteGroupLabel
      className={className}
      data-slot="command-group-label"
      {...props}
    />
  );
}

export const CommandCollection = AutocompleteCollection;

export function CommandItem({
  className,
  ...props
}: React.ComponentProps<typeof AutocompleteItem>): React.ReactElement {
  return (
    <AutocompleteItem
      className={cx("py-1.5", className)}
      data-slot="command-item"
      {...props}
    />
  );
}

export function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof AutocompleteSeparator>): React.ReactElement {
  return (
    <AutocompleteSeparator
      className={cx("my-2", className)}
      data-slot="command-separator"
      {...props}
    />
  );
}

export function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<"kbd">): React.ReactElement {
  return (
    <kbd
      className={cx(
        "ms-auto font-medium font-sans text-text-secondary/72 text-xs tracking-widest",
        className,
      )}
      data-slot="command-shortcut"
      {...props}
    />
  );
}

export function CommandFooter({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cx(
        "flex items-center justify-between gap-2 rounded-b-[calc(var(--radius-3xl)-1px)] border-t border-separator-border px-5 py-3 text-text-secondary text-xs",
        className,
      )}
      data-slot="command-footer"
      {...props}
    />
  );
}

/** 兼置 namespace stub：无消费方使用其成员。 */
const CommandDialogPrimitive = {
  Root: CommandDialog,
  Portal: CommandDialogPortal,
  Trigger: CommandDialogTrigger,
  Backdrop: CommandDialogBackdrop,
} as unknown as Record<string, unknown>

export {
  CommandDialog,
  CommandDialogPortal,
  CommandDialogTrigger,
  CommandDialogBackdrop,
  CommandDialogPopup,
  CommandCreateHandle,
  CommandDialogPrimitive,
}
