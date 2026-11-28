"use client";

import { useTemplateCopy } from "@/components/foundations/template-copy/template-copy";

import { useCallback, useState, type ComponentType, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/base/badges/badge";
import { cx } from "@/utils/cx";

/**
 * Figma sources:
 *   expanded  → Board UI → dashboard 1 → Sidebar (node 3731:2934)
 *   collapsed → Board UI → Sidebar (node 3768:3382)
 *
 * Floating sidebar panel. Expanded: 260px wide, p 12, radius/3xl (24px),
 * white 1px border, "Background/Sidebar Elevation" shadow, bg
 * background/secondary. Collapsed: 60px wide (36px icon items + 12px
 * padding); collapse button sits centered above the workspace avatar, quick
 * search becomes a 36px neutral-200 square, nav items become icon-only
 * squares, the team card reduces to its avatar.
 *
 * The two states morph into each other: the panel width animates while
 * labels / badges / kbd collapse via max-width + opacity.
 */

type IconComponent = ComponentType<{
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}>;

/**
 * Collapsible text/badge slot: blurs + fades + shrinks away when the rail
 * closes, and blurs back in on expand. The icons/rows themselves stay pinned in
 * place — only these label/badge slots animate — so nothing jumps to center.
 */
function Collapsible({ collapsed, children, className }: { collapsed: boolean; children: ReactNode; className?: string }) {
  const localize = useTemplateCopy();
  return localize((
    <span
      className={cx(
        "flex min-w-0 items-center overflow-hidden transition-[max-width,opacity,filter] duration-300 ease-in-out",
        // Expanded, the cap is the row itself: a fixed cap (it was 160px)
        // clipped any label wider than it, "Components and Blocks" included.
        collapsed ? "max-w-0 opacity-0 blur-[3px]" : "max-w-full opacity-100 blur-0",
        className,
      )}
    >
      {children}
    </span>
  ));
}

function NavItem({
  icon: Icon,
  label,
  badge,
  isSelected = false,
  collapsed = false,
  href = "#",
  onClick,
}: {
  icon: IconComponent;
  label: string;
  badge?: ReactNode;
  isSelected?: boolean;
  collapsed?: boolean;
  href?: string;
  /** Action rows (e.g. Settings → modal) intercept the navigation. */
  onClick?: () => void;
}) {
  const localize = useTemplateCopy();
  const navigate = useNavigate();
  return localize((
    <a
      href={href}
      onClick={
        onClick
          ? (event) => {
              event.preventDefault();
              onClick();
            }
          : (event) => {
              // SPA 客户端导航：拦截内部路径的整页跳转，避免路由切换闪白。
              // 放行修饰键/非左键（保留新标签页打开等浏览器行为）与非内部路径。
              if (
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              ) {
                return;
              }
              if (!href.startsWith("/")) return;
              event.preventDefault();
              navigate(href);
            }
      }
      aria-current={isSelected ? "page" : undefined}
      aria-label={label}
      title={collapsed ? label : undefined}
      className={cx(
        // `relative`（定位、DOM 在滑块之后）让行内容绘制在共享滑块之上；选中背景
        // 由 NavRows 的滑块承载，行本身保持透明背景。
        "relative flex items-center justify-between overflow-hidden rounded-2lg p-2",
        "transition-[width,background-color] duration-300 ease-in-out",
        collapsed ? "w-9" : "w-full",
        !isSelected && "hover:bg-background-secondary-hover",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon
          className={cx(
            "size-5 shrink-0 transition-colors duration-300 ease-in-out",
            isSelected ? "text-white" : "text-foreground-icon-secondary",
          )}
          aria-hidden
        />
        <Collapsible collapsed={collapsed}>
          <span
            className={cx(
              "text-body-medium whitespace-nowrap transition-colors duration-300 ease-in-out",
              isSelected ? "text-white" : "text-text-secondary",
            )}
          >
            {label}
          </span>
        </Collapsible>
      </span>
      {badge && <Collapsible collapsed={collapsed}>{badge}</Collapsible>}
    </a>
  ));
}

/** A primary navigation row. Rows without an `href` are decoration only. */
export interface DashboardNavItem {
  key: string;
  label: string;
  icon: IconComponent;
  href?: string;
  badge?: string | number;
}

/** Kept as a name for callers that typed their `selected` prop; any key works. */
export type DashboardNavKey = string;

/**
 * The primary rows. A component of its own so the closures over `collapsed`
 * and the search query live here: built inline in the sidebar, the compiler
 * could not tell they leave `mobile` untouched and dropped the sidebar's
 * manual memoization.
 */
function NavRows({
  items,
  query,
  selected,
  collapsed,
  secondaryMatch,
}: {
  items: DashboardNavItem[];
  query: string;
  selected: string;
  collapsed: boolean;
  /** Whether Support or Settings matches, so "No results" only shows when nothing does. */
  secondaryMatch: boolean;
}) {
  const localize = useTemplateCopy();
  const shown = items.filter((item) => item.label.toLocaleLowerCase().includes(query));
  if (shown.length === 0 && !secondaryMatch && !collapsed) {
    return localize(<p className="px-2 py-3 text-body-regular text-text-tertiary">No results</p>);
  }
  // 共享滑块：所有行恒高 36px（p-2 + 20px 内容，文字/徽标高度都不超过 icon 的 20px）、
  // nav 行间距 gap-1（4px），所以激活位置 = 序号 × (100% + 4px) —— 无需测量 DOM。
  // 切换激活项时 React 只更新这个序号，位移/淡出全由 CSS transition 补间；
  // 选中项被搜索过滤掉时序号为 -1，滑块淡出。
  const activeIndex = shown.findIndex((item) => item.key === selected);
  const slider = (
    <span
      aria-hidden
      className={cx(
        "pointer-events-none absolute top-0 h-9 rounded-2lg bg-linear-to-b from-accent-500 to-accent-600 shadow-nav-selected",
        "transition-[transform,opacity,left,right] duration-300 ease-in-out",
        // 展开态 nav 有 px-0.5（2px 内缩），滑块同步内缩对齐每行；折叠态 nav 无内缩。
        collapsed ? "inset-x-0" : "inset-x-0.5",
        activeIndex >= 0 ? "opacity-100" : "opacity-0",
      )}
      style={{ transform: `translateY(calc(${activeIndex < 0 ? 0 : activeIndex} * (100% + 4px)))` }}
    />
  );
  return [
    slider,
    ...shown.map((item) => {
      const isSelected = selected === item.key;
      return (
        <NavItem
          key={item.key}
          icon={item.icon}
          label={item.label}
          href={item.href}
          isSelected={isSelected}
          collapsed={collapsed}
          badge={
            item.badge !== undefined ? (
              <Badge
                color={isSelected ? "primary" : "neutral"}
                className="transition-colors duration-300 ease-in-out"
              >
                {item.badge}
              </Badge>
            ) : undefined
          }
        />
      );
    }),
  ];
}

export function DashboardSidebar({
  mobile = false,
  onClose,
  fluid = false,
  selected = "home",
  items,
  flat = false,
  className,
  collapsed: collapsedControlled,
  onCollapsedChange,
}: {
  /** Rendered inside the mobile drawer: always expanded, close button instead of collapse. */
  mobile?: boolean;
  onClose?: () => void;
  /** Expanded width fills its container below `lg` instead of the fixed
   *  260px (e.g. the landing page, where the sidebar isn't in a drawer).
   *  Collapsed width stays the fixed 60px rail at every breakpoint — the
   *  whole point of collapsing is to shrink, so it must never get
   *  overridden back to full width. */
  fluid?: boolean;
  /** Which nav item shows the selected (filled blue) state. */
  selected?: DashboardNavKey;
  /** Primary navigation rows. */
  items: DashboardNavItem[];
  /** Removes the floating panel treatment for a sidebar revealed beneath mobile content. */
  flat?: boolean;
  className?: string;
  /** Controlled collapse state (e.g. a host layout animating its own rail width). */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}) {
  const localize = useTemplateCopy();
  const [collapsedState, setCollapsed] = useState(false);
  const toggleCollapsed = useCallback(
    (next: boolean) => {
      setCollapsed(next);
      onCollapsedChange?.(next);
    },
    [onCollapsedChange],
  );
  const collapsed = mobile
    ? false
    : (collapsedControlled ?? collapsedState);

  return localize((
    <aside
      className={cx(
        "flex h-full shrink-0 flex-col justify-between overflow-hidden",
        flat
          ? "bg-background-full"
          : "rounded-3xl border border-border-button-white bg-background-secondary-default shadow-sidebar",
        "transition-[width] duration-300 ease-in-out",
        // Collapsed rail keeps the 60px spec: 1px border + 11px padding on each
        // side leaves an exactly 36px column so the w-9 (36px) icon items center.
        collapsed
          ? "w-[60px] px-[11px] py-3"
          : fluid
            ? "w-full p-3 lg:w-[260px]"
            : "w-[260px] p-3",
        className,
      )}
    >
      {/* `overflow-y: auto` forces the x axis to clip too, and this box hugs
          its contents on every side — so the selected item's 1px ring, the
          profile's hover pill (which outsets 6px) and focus rings all landed
          outside it. Padding moves the clip edge out; the matching negative
          margin borrows that space back from the rail's own padding, leaving
          every child exactly where it was. */}
      <div
        className="-m-2 flex min-h-0 w-[calc(100%+16px)] flex-col gap-3 overflow-y-auto p-2 [scrollbar-width:none]"
      >
      
        <div className="flex w-full flex-col gap-3">
          {/* Primary nav. The 2px inset is for the expanded rail only: the
              collapsed column is exactly as wide as a 36px item, so padding
              here pushes every item 2px right and the rail's own clip shaves
              that much off its selected fill and hover state. */}
          <nav className={cx("relative flex w-full flex-col gap-1", !collapsed && "px-0.5")}>
            <NavRows
              items={items}
              query=""
              selected={selected}
              collapsed={collapsed}
              secondaryMatch={false}
            />
          </nav>
        </div>
      </div>
    </aside>
  ));
}
