"use client";

/**
 * Autocomplete — local implementation replacing the Base UI autocomplete
 * primitives. Covers the subset this app actually uses (see
 * command-palette.tsx / command.tsx): an inline, always-open combobox with
 * render-prop collections:
 *
 *   <Autocomplete items={groups} filter={(item, query) => bool}
 *                 value={q} onValueChange={setQ}>
 *     <AutocompleteList>           {/* children: (group) => ReactNode *}
 *       {(group) => (
 *         <AutocompleteGroup items={group.items}>
 *           <AutocompleteCollection> {/* children: (item) => ReactNode *}
 *             {(item) => <AutocompleteItem onClick={...} />}
 *           </AutocompleteCollection>
 *         </AutocompleteGroup>
 *       )}
 *     </AutocompleteList>
 *   </Autocomplete>
 *
 * Filtering: `filter(item, query)` is applied to leaf items. Groups whose
 * items all fail the filter are skipped by the list. Keyboard: ArrowUp/Down
 * move the highlight across rendered items (data-highlighted), Enter clicks
 * the highlighted item, Home/End jump; all honor defaultPrevented.
 */

import * as React from "react";
import { ChevronsUpDownIcon, XIcon } from "lucide-react";
import type * as ReactType from "react";
import { cx } from "@/utils/cx";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

// ---------------------------------------------------------------------------
// Types (Base UI compatible surface)
// ---------------------------------------------------------------------------

export interface AutocompleteItemShape {
  value: string | number | null;
  label?: React.ReactNode;
  [key: string]: unknown;
}

export type AutocompleteFilter = (
  item: unknown,
  query: string,
) => boolean;

interface AutocompleteContextValue {
  query: string;
  setQuery: (query: string) => void;
  filter: AutocompleteFilter;
  groups: Array<{ items?: unknown[] } & object>;
  /** Flat list of items that pass the filter, in render order. */
  filteredItems: unknown[];
  highlightedEl: HTMLElement | null;
  registerItemElement: (el: HTMLElement | null) => void;
  handleInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

const AutocompleteContext =
  React.createContext<AutocompleteContextValue | null>(null);

function useAutocompleteContext(componentName: string): AutocompleteContextValue {
  const ctx = React.useContext(AutocompleteContext);
  if (!ctx) {
    throw new Error(`${componentName} must be rendered inside <Autocomplete>`);
  }
  return ctx;
}

/** Per-item index context provided by AutocompleteCollection. */
const ItemIndexContext = React.createContext<number>(-1);
void ItemIndexContext;

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export type AutocompleteProps = {
  items?: Array<{ items?: unknown[] } & object>;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  filter?: AutocompleteFilter;
  autoHighlight?: boolean | "always";
  keepHighlight?: boolean;
  inline?: boolean;
  open?: boolean;
  children?: React.ReactNode;
  className?: string;
  [key: string]: unknown;
};

const defaultFilter: AutocompleteFilter = (item, query) => {
  if (!query) return true;
  const label =
    typeof item === "string" || typeof item === "number"
      ? String(item)
      : String((item as { label?: unknown })?.label ?? (item as { value?: unknown })?.value ?? "");
  return normalize(label).includes(normalize(query));
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "");
}

function AutocompleteRoot({
  items = [],
  value: controlledValue,
  defaultValue = "",
  onValueChange,
  filter = defaultFilter,
  autoHighlight,
  keepHighlight,
  inline,
  open,
  children,
  className,
  ...rest
}: AutocompleteProps): React.ReactElement {
  void keepHighlight;
  void inline;
  void open;
  void className;
  void rest;

  const [uncontrolledQuery, setUncontrolledQuery] = React.useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const query = isControlled ? controlledValue : uncontrolledQuery;

  const setQuery = React.useCallback(
    (next: string) => {
      if (!isControlled) {
        setUncontrolledQuery(next);
      }
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  const flatItems = React.useMemo(() => {
    const leaves: unknown[] = [];
    for (const group of items) {
      if (Array.isArray(group?.items)) {
        leaves.push(...group.items);
      } else {
        leaves.push(group);
      }
    }
    return leaves;
  }, [items]);

  const filteredItems = React.useMemo(
    () => flatItems.filter((item) => query === "" || filter(item, query)),
    [flatItems, filter, query],
  );

  const [highlightedEl, setHighlightedEl] = React.useState<HTMLElement | null>(
    null,
  );
  const itemElements = React.useRef<HTMLElement[]>([]);

  const orderedElements = React.useCallback((): HTMLElement[] => {
    return [...itemElements.current].sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
  }, []);

  // Reset the highlight when the query changes (autoHighlight "always").
  React.useEffect(() => {
    if (autoHighlight) {
      setHighlightedEl(orderedElements()[0] ?? null);
    }
  }, [query, autoHighlight, orderedElements]);

  const registerItemElement = React.useCallback(
    (el: HTMLElement | null) => {
      if (el === null) return;
      if (!itemElements.current.includes(el)) {
        itemElements.current.push(el);
      }
    },
    [],
  );

  // Drop detached elements before navigating.
  const prune = React.useCallback(() => {
    itemElements.current = itemElements.current.filter((el) =>
      el.isConnected,
    );
  }, []);

  const handleInputKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.defaultPrevented) return;
      prune();
      const els = orderedElements();
      if (els.length === 0) return;
      const current = highlightedEl?.isConnected ? highlightedEl : null;
      const currentIndex = current ? els.indexOf(current) : -1;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightedEl(els[(currentIndex + 1 + els.length) % els.length]);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightedEl(
          els[(currentIndex - 1 + els.length) % els.length],
        );
      } else if (event.key === "Home") {
        event.preventDefault();
        setHighlightedEl(els[0]);
      } else if (event.key === "End") {
        event.preventDefault();
        setHighlightedEl(els[els.length - 1]);
      } else if (event.key === "Enter") {
        if (current) {
          event.preventDefault();
          current.click();
        }
      }
    },
    [highlightedEl, orderedElements, prune],
  );

  const contextValue = React.useMemo<AutocompleteContextValue>(
    () => ({
      query,
      setQuery,
      filter,
      groups: items,
      filteredItems,
      highlightedEl,
      registerItemElement,
      handleInputKeyDown,
    }),
    [
      query,
      setQuery,
      filter,
      items,
      filteredItems,
      highlightedEl,
      registerItemElement,
      handleInputKeyDown,
    ],
  );

  return (
    <AutocompleteContext.Provider value={contextValue}>
      {children}
    </AutocompleteContext.Provider>
  );
}

export const Autocomplete = AutocompleteRoot;

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export type AutocompleteInputProps = Omit<
  ReactType.ComponentProps<"input">,
  "size" | "children"
> & {
  showTrigger?: boolean;
  showClear?: boolean;
  startAddon?: React.ReactNode;
  size?: "sm" | "default" | "lg" | number;
  triggerProps?: ReactType.ComponentProps<"button">;
  clearProps?: ReactType.ComponentProps<"button">;
};

export function AutocompleteInput({
  className,
  showTrigger = false,
  showClear = false,
  startAddon,
  size,
  triggerProps,
  clearProps,
  value: valueProp,
  onChange: onChangeProp,
  onKeyDown,
  ...props
}: AutocompleteInputProps): React.ReactElement {
  const { query, setQuery, handleInputKeyDown } =
    useAutocompleteContext("AutocompleteInput");
  const sizeValue = (size ?? "default") as "sm" | "default" | "lg" | number;
  void valueProp;

  return (
    <div
      className="relative not-has-[>*.w-full]:w-fit w-full text-text-primary has-disabled:opacity-64"
      data-slot="autocomplete-input-group"
    >
      {startAddon && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 start-px z-10 flex items-center ps-[calc(--spacing(3)-1px)] opacity-80 has-[+[data-size=sm]]:ps-[calc(--spacing(2.5)-1px)] [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:-mx-0.5"
          data-slot="autocomplete-start-addon"
        >
          {startAddon}
        </div>
      )}
      <Input
        nativeInput
        size={sizeValue}
        {...props}
        className={cx(
          startAddon && "ps-[calc(--spacing(8.5)-1px)]",
          sizeValue === "sm" ? "pe-6.5" : "pe-7",
          className,
        )}
        data-slot="autocomplete-input"
        value={query}
        onChange={(event) => {
          onChangeProp?.(event);
          setQuery(event.target.value);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          handleInputKeyDown(event);
        }}
      />
      {showTrigger && (
        <AutocompleteTrigger
          className={cx(
            "absolute top-1/2 inline-flex size-8 shrink-0 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border border-transparent opacity-80 outline-none transition-colors pointer-coarse:after:absolute pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:opacity-100 has-[+[data-slot=autocomplete-clear]]:hidden sm:size-7 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
            sizeValue === "sm" ? "end-0" : "end-0.5",
          )}
          {...triggerProps}
        >
          <ChevronsUpDownIcon />
        </AutocompleteTrigger>
      )}
      {showClear && (
        <AutocompleteClear
          className={cx(
            "absolute top-1/2 inline-flex size-8 shrink-0 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border border-transparent opacity-80 outline-none transition-colors pointer-coarse:after:absolute pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:opacity-100 has-[+[data-slot=autocomplete-clear]]:hidden sm:size-7 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
            sizeValue === "sm" ? "end-0" : "end-0.5",
          )}
          {...clearProps}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// List / Collection / Group
// ---------------------------------------------------------------------------

export type AutocompleteListProps = Omit<
  ReactType.ComponentProps<"div">,
  "children"
> & {
  children?: (group: unknown, index: number) => React.ReactNode;
};

export function AutocompleteList({
  className,
  children,
  ...props
}: AutocompleteListProps): React.ReactElement {
  const { groups, filter, query } = useAutocompleteContext("AutocompleteList");

  const visibleGroups = React.useMemo(
    () =>
      groups.filter((group) => {
        if (query === "") return true;
        const leaves = Array.isArray(group?.items) ? group.items : [group];
        return leaves.some((item) => filter(item, query));
      }),
    [groups, filter, query],
  );

  return (
    <ScrollArea overscrollContain scrollbarGutter scrollFade>
      <div
        className={cx(
          "not-empty:scroll-py-1 not-empty:p-1 in-data-has-overflow-y:pe-3",
          className,
        )}
        data-slot="autocomplete-list"
        {...props}
      >
        {typeof children === "function"
          ? visibleGroups.map((group, index) => children(group, index))
          : children}
      </div>
    </ScrollArea>
  );
}

const GroupItemsContext = React.createContext<unknown[]>([]);

export type AutocompleteGroupProps = ReactType.ComponentProps<"div"> & {
  items?: unknown[];
};

export function AutocompleteGroup({
  className,
  items,
  children,
  ...props
}: AutocompleteGroupProps): React.ReactElement {
  return (
    <GroupItemsContext.Provider value={items ?? []}>
      <div
        className={cx("[[role=group]+&]:mt-1.5", className)}
        role="group"
        data-slot="autocomplete-group"
        {...props}
      >
        {children}
      </div>
    </GroupItemsContext.Provider>
  );
}

export function AutocompleteGroupLabel({
  className,
  ...props
}: ReactType.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cx(
        "px-2 py-1.5 font-medium text-text-secondary text-xs",
        className,
      )}
      data-slot="autocomplete-group-label"
      {...props}
    />
  );
}

export type AutocompleteCollectionProps = {
  children?: (item: unknown, index: number) => React.ReactNode;
  className?: string;
  [key: string]: unknown;
};

export function AutocompleteCollection({
  children,
  ...props
}: AutocompleteCollectionProps): React.ReactElement {
  const items = React.useContext(GroupItemsContext);
  void props;
  if (typeof children !== "function") {
    return <>{children}</>;
  }
  return (
    <>
      {items.map((item, index) => (
        <React.Fragment key={index}>{children(item, index)}</React.Fragment>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Item / Empty / Row
// ---------------------------------------------------------------------------

export type AutocompleteItemProps = ReactType.ComponentProps<"div"> & {
  /** Base UI 兼容：item 声明值（运行时作为过滤回退文本）。 */
  value?: string | number;
};

export function AutocompleteItem({
  className,
  children,
  ...props
}: AutocompleteItemProps): React.ReactElement {
  const { highlightedEl, registerItemElement } = useAutocompleteContext(
    "AutocompleteItem",
  );
  const [el, setEl] = React.useState<HTMLDivElement | null>(null);
  const ref = React.useCallback(
    (node: HTMLDivElement | null) => {
      registerItemElement(node);
      setEl(node);
    },
    [registerItemElement],
  );
  const isHighlighted = el != null && el === highlightedEl;

  return (
    <div
      ref={ref}
      role="option"
      aria-selected={isHighlighted}
      tabIndex={-1}
      className={cx(
        "flex min-h-8 cursor-default select-none items-center rounded-sm px-2 py-1 text-base outline-none data-disabled:pointer-events-none data-highlighted:bg-background-primary-hover data-highlighted:text-text-primary data-disabled:opacity-64 sm:min-h-7 sm:text-sm",
        className,
      )}
      data-slot="autocomplete-item"
      data-highlighted={isHighlighted ? "" : undefined}
      {...props}
    >
      {children}
    </div>
  );
}

export function AutocompleteEmpty({
  className,
  children,
  ...props
}: ReactType.ComponentProps<"div">): React.ReactElement {
  const { filteredItems } = useAutocompleteContext("AutocompleteEmpty");
  if (filteredItems.length > 0) {
    return <div data-slot="autocomplete-empty" />;
  }
  return (
    <div
      className={cx(
        "not-empty:p-2 text-center text-base text-text-secondary sm:text-sm",
        className,
      )}
      data-slot="autocomplete-empty"
      {...props}
    >
      {children}
    </div>
  );
}

export function AutocompleteRow({
  className,
  ...props
}: ReactType.ComponentProps<"div">): React.ReactElement {
  return (
    <div className={className} data-slot="autocomplete-row" {...props} />
  );
}

// ---------------------------------------------------------------------------
// Popup / Portal / Positioner / Trigger / Clear / Status / Value / filter hook
// ---------------------------------------------------------------------------

export function AutocompletePortal({
  children,
  ...props
}: { children?: React.ReactNode; [key: string]: unknown }): React.ReactElement {
  void props;
  return <>{children}</>;
}

export function AutocompletePositioner({
  children,
  ...props
}: { children?: React.ReactNode; [key: string]: unknown }): React.ReactElement {
  void props;
  return <>{children}</>;
}

export function AutocompletePopup({
  className,
  children,
  ...props
}: ReactType.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cx(
        "relative flex max-h-full min-w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) rounded-2lg border border-border-button-default bg-background-primary-default not-dark:bg-clip-padding shadow-lg/5 transition-[scale,opacity]",
        className,
      )}
      data-slot="autocomplete-popup"
      {...props}
    >
      {children}
    </div>
  );
}

export function AutocompleteTrigger({
  className,
  children,
  ...props
}: ReactType.ComponentProps<"button">): React.ReactElement {
  return (
    <button
      type="button"
      className={className}
      data-slot="autocomplete-trigger"
      {...props}
    >
      {children}
    </button>
  );
}

export function AutocompleteClear({
  className,
  onClick,
  ...props
}: ReactType.ComponentProps<"button">): React.ReactElement {
  const { setQuery } = useAutocompleteContext("AutocompleteClear");
  return (
    <button
      type="button"
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          setQuery("");
        }
      }}
      className={cx(
        "absolute end-0.5 top-1/2 inline-flex size-8 shrink-0 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border border-transparent opacity-80 outline-none transition-[color,background-color,box-shadow,opacity] pointer-coarse:after:absolute pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:opacity-100 sm:size-7 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      data-slot="autocomplete-clear"
      {...props}
    >
      <XIcon />
    </button>
  );
}

export function AutocompleteStatus({
  className,
  ...props
}: ReactType.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cx(
        "px-3 py-2 font-medium text-text-secondary text-xs empty:m-0 empty:p-0",
        className,
      )}
      data-slot="autocomplete-status"
      {...props}
    />
  );
}

/** Displays the selected item label; not used by current consumers. */
export function AutocompleteValue({
  children,
  ...props
}: ReactType.ComponentProps<"span">): React.ReactElement {
  void props;
  return <span data-slot="autocomplete-value">{children}</span>;
}

/** Separator rendered between autocomplete items/groups. */
export function AutocompleteSeparator({
  className,
  ...props
}: ReactType.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      role="separator"
      className={cx("mx-2 my-1 h-px bg-separator-border last:hidden", className)}
      data-slot="autocomplete-separator"
      {...props}
    />
  );
}

/**
 * Base UI-compatible filter hook. `sensitivity: "base"` folds case and
 * diacritics. `contains(item, query, getItemText?)` matches the query
 * against `getItemText(item)` when provided, else item.label/item.value.
 */
export function useAutocompleteFilter(options?: {
  sensitivity?: "base" | "variant";
}): {
  contains: (
    item: unknown,
    query: string,
    getItemText?: (item: unknown) => string,
  ) => boolean;
} {
  const sensitivity = options?.sensitivity ?? "variant";
  return React.useMemo(
    () => ({
      contains(item, query, getItemText) {
        if (!query) return true;
        const text = getItemText
          ? getItemText(item)
          : String(
              (item as { label?: unknown })?.label ??
                (item as { value?: unknown })?.value ??
                item,
            );
        const norm =
          sensitivity === "base" ? (s: string) => normalize(s) : (s: string) => s;
        return norm(text).toLowerCase().includes(norm(query).toLowerCase());
      },
    }),
    [sensitivity],
  );
}
