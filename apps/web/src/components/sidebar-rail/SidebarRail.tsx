import {
  useId,
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
} from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import {
  // Bind `m` to the full `motion` component: the app never mounts
  // <LazyMotion features>, so the lazy `m` subset applies initial values but
  // never runs animate updates (collapse toggle appeared dead).
  motion as m,
  useReducedMotion,
  useMotionValue,
  useTransform,
  LayoutGroup,
  AnimatePresence,
} from "motion/react";
import {
  Workflow,
  AppWindow,
  LayoutDashboard,
  ChevronRight,
  X,
  Settings,
  Moon,
  Sun,
  Search,
  LogOut,
  MoreVertical,
  type LucideIcon,
} from "lucide-react";
import { useSearchCommands } from "@/stores/search-commands/store";
import { useAccountStore } from "@/stores/account";
import { removeToken } from "@/lib/auth";
import { loginHrefWithRef } from "@/lib/routes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { resolveServerAssetUrl } from "@/lib/server";
import { useTranslations } from "next-intl";
import { useTheme } from "../layout/theme-provider";
import { SettingsDialog } from "../settings/settings-dialog";
import {
  DashboardSidebar,
  type DashboardNavItem,
} from "@/components/application/dashboard/dashboard-sidebar";
import { RiHomeLine, RiFlowChart, RiLayoutGridLine } from "@remixicon/react";
import { Avatar } from "./Avatar";
import { Tooltip } from "./Tooltip";
import { T } from "./motion-tokens";
import styles from "./sidebar-rail.module.css";
import "./rail-tokens.css";

type NavChild = { id: string; label: string };
type NavEntry = NavChild & {
  icon?: LucideIcon;
  count?: number;
  children?: NavChild[];
};
type NavSection = { id: string; heading?: string; items: NavEntry[] };

/** Nav entries for the routes rendered inside this layout (see app/router.tsx). */
const SECTIONS: NavSection[] = [
  {
    id: "workspace",
    heading: "Workspace",
    items: [
      { id: "/home", label: "Home", icon: LayoutDashboard },
      { id: "/workflows", label: "Workflows", icon: Workflow },
      { id: "/mini-apps", label: "Mini Apps", icon: AppWindow },
    ],
  },
];

/** Breadcrumb titles for paths inside this layout. */
const ROUTE_TITLES: Record<string, string> = {
  "/home": "Home",
  "/workflows": "Workflows",
  "/mini-apps": "Mini Apps",
};

/** The same three routes as SECTIONS, typed for the BoardUI sidebar. */
const BOARDUI_NAV: DashboardNavItem[] = [
  { key: "/home", label: "Home", icon: RiHomeLine, href: "/home" },
  { key: "/workflows", label: "Workflows", icon: RiFlowChart, href: "/workflows" },
  { key: "/mini-apps", label: "Mini Apps", icon: RiLayoutGridLine, href: "/mini-apps" },
];

const INSTANT = { duration: 0 };

function labelTransition(collapsed: boolean, reduce: boolean) {
  return reduce
    ? INSTANT
    : collapsed
      ? { duration: 0.14, ease: T.ease.standard }
      : { duration: 0.24, delay: 0.1, ease: T.ease.enter };
}

function delayedTransition(collapsed: boolean, reduce: boolean) {
  return reduce
    ? INSTANT
    : collapsed
      ? { duration: 0.2, delay: 0.16, ease: T.ease.enter }
      : { duration: 0.1, ease: T.ease.standard };
}

const swapVariants = {
  hidden: { opacity: 0, y: 8, filter: `blur(${T.blur.soft}px)` },
  shown: { opacity: 1, y: 0, filter: "blur(0px)" },
  gone: { opacity: 0, y: -6, filter: `blur(${T.blur.subtle}px)` },
};

function Tip({
  enabled,
  label,
  note,
  children,
}: {
  enabled: boolean;
  label: string;
  note?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!enabled && open) setOpen(false);
  return (
    <TooltipPrimitive.Root
      open={enabled && open}
      onOpenChange={(next) => setOpen(next && enabled)}
    >
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          // fs-rail-tokens: portaled to <body>, outside the token-scoped rail
          className={`${styles.tip} fs-rail-tokens`}
          side="right"
          sideOffset={14}
          collisionPadding={8}
        >
          {label}
          {note && <span className={styles.tipNote}>{note}</span>}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

function NavItem({
  entry,
  nested,
  current,
  lit,
  expanded,
  turned,
  controls,
  collapsed,
  tips,
  layoutId,
  reduce,
  onClick,
}: {
  entry: NavChild & { icon?: LucideIcon; count?: number };
  nested?: boolean;
  current: boolean;
  lit: boolean;
  expanded?: boolean;
  turned?: boolean;
  controls?: string;
  collapsed: boolean;
  tips: boolean;
  layoutId: string;
  reduce: boolean;
  onClick: () => void;
}) {
  const Icon = entry.icon;
  const labelT = labelTransition(collapsed, reduce);
  const delayedT = delayedTransition(collapsed, reduce);
  return (
    <Tip
      enabled={tips}
      label={entry.label}
      note={entry.count ? `${entry.count} unread` : undefined}
    >
      <button
        type="button"
        className={[styles.item, nested ? styles.nested : "", lit ? styles.lit : ""].join(" ")}
        aria-current={current ? "page" : undefined}
        aria-expanded={expanded}
        aria-controls={controls}
        onClick={onClick}
      >
        {lit && (
          <m.span
            layoutId={layoutId}
            className={styles.highlight}
            style={{ borderRadius: 8 }}
            transition={reduce ? INSTANT : T.spring.morph}
          />
        )}
        {Icon && (
          <Icon
            className={styles.icon}
            size={16}
            strokeWidth={1.75}
            aria-hidden="true"
          />
        )}
        <m.span
          className={styles.label}
          initial={false}
          animate={{ opacity: +!collapsed, x: collapsed ? -6 : 0 }}
          transition={labelT}
        >
          {entry.label}
          {entry.count ? (
            <span className={styles.srOnly}>
              {", "}
              {entry.count} unread
            </span>
          ) : null}
        </m.span>
        {entry.count ? (
          <>
            <m.span
              className={styles.count}
              aria-hidden="true"
              initial={false}
              animate={{ opacity: +!collapsed }}
              transition={labelT}
            >
              {entry.count}
            </m.span>
            <m.span
              className={styles.dot}
              aria-hidden="true"
              initial={false}
              animate={{ opacity: +!!collapsed, scale: collapsed ? 1 : 0.3 }}
              transition={
                collapsed && !reduce ? { ...T.spring.snappy, delay: 0.16 } : delayedT
              }
            />
          </>
        ) : null}
        {turned !== undefined && (
          <m.span
            className={styles.chevron}
            aria-hidden="true"
            initial={false}
            animate={{ opacity: +!collapsed, rotate: 90 * Number(!!turned) }}
            transition={{ opacity: labelT, rotate: reduce ? INSTANT : T.spring.snappy }}
          >
            <ChevronRight size={14} strokeWidth={1.75} />
          </m.span>
        )}
      </button>
    </Tip>
  );
}

function Nav({
  variant,
  baseId,
  collapsed,
  active,
  open,
  reduce,
  onSelect,
  onGroup,
}: {
  variant: "side" | "sheet";
  baseId: string;
  collapsed: boolean;
  active: string;
  open: Record<string, boolean>;
  reduce: boolean;
  onSelect: (id: string) => void;
  onGroup: (id: string) => void;
}) {
  const tips = variant === "side" && collapsed;
  const layoutId = `${variant}-active`;
  const heightSpring = reduce ? INSTANT : T.spring.smooth;
  const shared = { collapsed, tips, layoutId, reduce };
  return (
    <m.nav className={styles.nav} aria-label="Flow Spaces" layoutScroll>
      {SECTIONS.map((section) => {
        const headingId = `${baseId}-${variant}-${section.id}`;
        return (
          <div
            key={section.id}
            className={styles.section}
            role={section.heading ? "group" : undefined}
            aria-labelledby={section.heading ? headingId : undefined}
          >
            {section.heading && (
              <m.div
                className={styles.heading}
                initial={false}
                animate={{ height: collapsed ? 17 : 32 }}
                transition={heightSpring}
              >
                <m.span
                  id={headingId}
                  className={styles.headingText}
                  initial={false}
                  animate={{ opacity: +!collapsed, x: collapsed ? -6 : 0 }}
                  transition={labelTransition(collapsed, reduce)}
                >
                  {section.heading}
                </m.span>
                <m.span
                  className={styles.divider}
                  aria-hidden="true"
                  initial={false}
                  animate={{ opacity: +!!collapsed, scaleX: collapsed ? 1 : 0.3 }}
                  transition={delayedTransition(collapsed, reduce)}
                />
              </m.div>
            )}
            <ul className={styles.list} role="list">
              {section.items.map((entry) => {
                if (!entry.children)
                  return (
                    <li key={entry.id}>
                      <NavItem
                        entry={entry}
                        current={active === entry.id}
                        lit={active === entry.id}
                        onClick={() => onSelect(entry.id)}
                        {...shared}
                      />
                    </li>
                  );
                const listId = `${baseId}-${variant}-${entry.id}-list`;
                const expanded = !!open[entry.id] && !collapsed;
                const containsActive = entry.children.some((c) => c.id === active);
                return (
                  <li key={entry.id}>
                    <NavItem
                      entry={entry}
                      current={false}
                      lit={containsActive && !expanded}
                      expanded={expanded}
                      turned={!!open[entry.id]}
                      controls={listId}
                      onClick={() => onGroup(entry.id)}
                      {...shared}
                    />
                    <m.ul
                      id={listId}
                      className={styles.children}
                      role="list"
                      inert={!expanded}
                      initial={false}
                      animate={
                        expanded
                          ? {
                              height: "auto",
                              opacity: 1,
                              transitionEnd: { overflow: "visible" },
                            }
                          : { height: 0, opacity: 0, overflow: "hidden" }
                      }
                      transition={{
                        height: heightSpring,
                        opacity: reduce
                          ? INSTANT
                          : {
                              duration: expanded ? 0.24 : 0.14,
                              delay: 0.06 * Number(!!expanded),
                              ease: T.ease.standard,
                            },
                      }}
                    >
                      {entry.children.map((child) => (
                        <li key={child.id}>
                          <NavItem
                            entry={child}
                            nested
                            current={active === child.id}
                            lit={expanded && active === child.id}
                            onClick={() => onSelect(child.id)}
                            {...shared}
                          />
                        </li>
                      ))}
                    </m.ul>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </m.nav>
  );
}

function Brand({ collapsed, reduce }: { collapsed: boolean; reduce: boolean }) {
  return (
    <div className={styles.brand}>
      <span className={styles.mark} data-logo="" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M12 3.5 5.5 19.5 12 15.6z" fill="currentColor" />
          <path
            d="M12 3.5l6.5 16-6.5-3.9z"
            fill="currentColor"
            opacity=".55"
          />
        </svg>
      </span>
      <m.span
        className={styles.stack}
        initial={false}
        animate={{ opacity: +!collapsed, x: collapsed ? -6 : 0 }}
        transition={labelTransition(collapsed, reduce)}
      >
        <strong>Flow Spaces</strong>
        <span>Workflow studio</span>
      </m.span>
    </div>
  );
}

function Profile({ collapsed, reduce }: { collapsed: boolean; reduce: boolean }) {
  const name = useAccountStore((s) => s.name);
  const avatarUrl = useAccountStore((s) => s.avatarUrl);
  const load = useAccountStore((s) => s.load);
  const navigate = useNavigate();
  const t = useTranslations("sidebar");

  useEffect(() => {
    void load();
  }, [load]);

  // 客户端路由跳登录页（带 ref）：Vite SPA 无静态导出产物，
  const handleSignOut = () => {
    removeToken();
    navigate(loginHrefWithRef(), { replace: true });
  };

  return (
    <div className={styles.profile}>
      <Avatar
        name={name}
        src={avatarUrl ? resolveServerAssetUrl(avatarUrl) : undefined}
        size="sm"
      />
      <m.span
        className={styles.stack}
        initial={false}
        animate={{ opacity: +!collapsed, x: collapsed ? -6 : 0 }}
        transition={labelTransition(collapsed, reduce)}
      >
        <strong>{name}</strong>
        <span>{name}</span>
      </m.span>
      {!collapsed && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className={`${styles.iconButton} ${styles.profileDots}`}
            aria-label={t("profile.openMenu")}
          >
            <MoreVertical size={16} strokeWidth={1.75} aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="top"
            className="w-auto min-w-36"
          >
            <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
              <LogOut aria-hidden="true" />
              {t("profile.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function SettingsButton({ onOpen }: { onOpen: () => void }) {
  const t = useTranslations("settings");
  const label = t("title");
  return (
    <Tip enabled label={label}>
      <button
        type="button"
        className={styles.localeToggle}
        aria-label={label}
        aria-haspopup="dialog"
        onClick={onOpen}
      >
        <Settings
          className={styles.icon}
          size={16}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </button>
    </Tip>
  );
}

/** 快速切换 浅色/深色 主题；当前为跟随系统时按实际生效主题取反。 */
function ThemeToggle() {
  const t = useTranslations("settings");
  const { resolvedTheme, setTheme } = useTheme();
  const next = resolvedTheme === "dark" ? "light" : "dark";
  const label = next === "dark" ? t("switchToDark") : t("switchToLight");
  const Icon = next === "dark" ? Moon : Sun;
  return (
    <Tip enabled label={label}>
      <button
        type="button"
        className={styles.localeToggle}
        aria-label={label}
        onClick={() => setTheme(next)}
      >
        <Icon
          className={styles.icon}
          size={16}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </button>
    </Tip>
  );
}

function PanelIcon({ collapsed, reduce }: { collapsed: boolean; reduce: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="2.75" y="3.75" width="14.5" height="12.5" rx="3.5" />
      <m.path
        d="M8.25 4.25v11.5"
        initial={false}
        animate={{ x: collapsed ? -2.5 : 0 }}
        transition={reduce ? INSTANT : T.spring.smooth}
      />
    </svg>
  );
}

export function SidebarRail() {
  const uid = useId();
  const navigate = useNavigate();
  const location = useLocation();
  const prefersReduced = !!useReducedMotion();
  const tPalette = useTranslations("commandPalette");
  const openPalette = useSearchCommands((s) => s.openPalette);
  const [mounted, setMounted] = useState(true);
  const reduce = prefersReduced || mounted;
  const [collapsed, setCollapsed] = useState(false);
  const [floating, setFloating] = useState(false);
  // Active nav id is route-driven; pages outside the wrapped route set keep
  // nothing highlighted (they never render inside this layout anyway).
  const active = ROUTE_TITLES[location.pathname] ? location.pathname : "";
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [sheet, setSheet] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shell, setShell] = useState<HTMLElement | null>(null);
  const [status, setStatus] = useState("");
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const dragging = useRef(false);
  const timeoutRef = useRef(0);
  const sidebarId = `${uid}-sidebar`;
  const pageTitle = ROUTE_TITLES[location.pathname] ?? "Not Found";

  useEffect(() => {
    const el = shell;
    if (!el) return;
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    function onKey(e: KeyboardEvent) {
      if (
        e.key !== "[" ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.defaultPrevented
      )
        return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      )
        return;
      const rect = el!.getBoundingClientRect();
      if (rect.width && !(rect.bottom < 0) && !(rect.top > window.innerHeight)) {
        e.preventDefault();
        if (el!.clientWidth < 480) {
          setSheet((s) => !s);
          return;
        }
        setCollapsed((c) => !c);
        setStatus(collapsed ? "Sidebar expanded" : "Sidebar collapsed");
      }
    }
  }, [shell, collapsed, sheet]);

  const wideRef = useRef<boolean | null>(null);
  useLayoutEffect(() => {
    if (!shell) return;
    const measure = () => {
      const width = shell.clientWidth;
      if (width >= 480) setSheet(false);
      const isFloating = width >= 480 && width < 640;
      setFloating(isFloating);
      const isWide = width >= 760;
      if (wideRef.current !== isWide) {
        wideRef.current = isWide;
        setCollapsed(!isWide);
      } else if (isFloating) setCollapsed(true);
    };
    measure();
    const raf = requestAnimationFrame(() => setMounted(false));
    const observer = new ResizeObserver(measure);
    observer.observe(shell);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [shell]);

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  const floatingOpen = floating && !collapsed;

  function closeFloat() {
    setCollapsed(true);
    setStatus("Sidebar collapsed");
  }

  function select(id: string, fromSheet = false) {
    if (fromSheet && dragging.current) return;
    navigate(id);
    setStatus(`${ROUTE_TITLES[id] ?? id} opened`);
    if (fromSheet || floatingOpen) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(
        () => (fromSheet ? setSheet(false) : setCollapsed(true)),
        200 * Number(!reduce),
      );
    }
  }

  function toggleGroup(id: string, fromSheet = false) {
    if (fromSheet && dragging.current) return;
    if (collapsed && !fromSheet) {
      setCollapsed(false);
      setOpen((o) => ({ ...o, [id]: true }));
      setStatus("Sidebar expanded");
      return;
    }
    setOpen((o) => ({ ...o, [id]: !o[id] }));
  }

  const sheetX = useMotionValue("-100%");
  const scrimOpacity = useTransform(sheetX, (v) => {
    const width = sheetRef.current?.offsetWidth || 288;
    const ratio =
      typeof v === "number"
        ? v / width
        : v.endsWith("%")
          ? parseFloat(v) / 100
          : parseFloat(v) / width;
    return Math.min(1, Math.max(0, 1 + (Number.isFinite(ratio) ? ratio : -1)));
  });
  const swapT = reduce
    ? INSTANT
    : { duration: T.duration.standard, ease: T.ease.enter };

  return (
    <LayoutGroup id={uid}>
      <TooltipPrimitive.Provider delayDuration={250} skipDelayDuration={300}>
        <section
          ref={setShell}
          className={styles.shell}
          aria-label="Flow Spaces workspace"
          onKeyDown={(e) => {
            if (
              e.key === "Escape" &&
              floatingOpen &&
              !e.defaultPrevented
            ) {
              e.preventDefault();
              closeFloat();
            }
          }}
        >
          <m.div
            className={styles.slot}
            initial={false}
            animate={{ width: floating || collapsed ? 74 : 250 }}
            transition={reduce ? INSTANT : T.spring.smooth}
          >
            <m.div
              id={sidebarId}
              className={`${styles.sidebar} fs-rail-tokens`}
              initial={false}
              animate={{ width: collapsed ? 64 : 240 }}
              transition={reduce ? INSTANT : T.spring.smooth}
              data-collapsed={collapsed || undefined}
              data-floating={floatingOpen || undefined}
            >
              <Brand collapsed={collapsed} reduce={reduce} />
              <DashboardSidebar
                items={BOARDUI_NAV.map((item) => ({
                  ...item,
                  onClick: () => select(item.key),
                }))}
                selected={active}
                collapsed={collapsed}
                onCollapsedChange={setCollapsed}
                hideUserMenu
                hideTeamMenu
                hideSecondaryNav
                hideSearch
                showThemeToggle={false}
                className="min-h-0 flex-1 !w-full !rounded-none !border-0 !bg-transparent !shadow-none"
              />
              <div className={styles.iconRow}>
                <ThemeToggle />
                <SettingsButton onOpen={() => setSettingsOpen(true)} />
              </div>
              <Profile collapsed={collapsed} reduce={reduce} />
            </m.div>
          </m.div>
          <AnimatePresence>
            {floatingOpen && (
              <m.div
                key="float-scrim"
                className={`${styles.scrim} ${styles.floatScrim}`}
                aria-hidden="true"
                onClick={closeFloat}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={
                  reduce
                    ? INSTANT
                    : { duration: T.duration.standard, ease: T.ease.standard }
                }
              />
            )}
          </AnimatePresence>
          <div className={styles.main}>
            <header className={`${styles.topbar} fs-rail-tokens`}>
              <Tooltip
                side="bottom"
                content={
                  <span className={styles.shortcut}>
                    {collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    <kbd>[</kbd>
                  </span>
                }
              >
                <button
                  type="button"
                  className={`${styles.iconButton} ${styles.railToggle}`}
                  aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                  aria-expanded={!collapsed}
                  aria-controls={sidebarId}
                  aria-keyshortcuts="["
                  onClick={() => {
                    setCollapsed(!collapsed);
                    setStatus(collapsed ? "Sidebar expanded" : "Sidebar collapsed");
                  }}
                >
                  <PanelIcon collapsed={collapsed} reduce={reduce} />
                </button>
              </Tooltip>
              <button
                ref={menuButtonRef}
                type="button"
                className={`${styles.iconButton} ${styles.menuButton}`}
                aria-label="Open navigation"
                aria-haspopup="dialog"
                aria-expanded={sheet}
                aria-keyshortcuts="["
                onClick={() => setSheet(true)}
              >
                <PanelIcon collapsed={false} reduce={reduce} />
              </button>
              <nav className={styles.crumbs} aria-label="Breadcrumb">
                <ol>
                  <li className={styles.crumbRoot}>Flow Spaces</li>
                  <li className={styles.crumbCurrent} aria-current="page">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <m.span
                        key={pageTitle}
                        variants={swapVariants}
                        initial="hidden"
                        animate="shown"
                        exit="gone"
                        transition={swapT}
                      >
                        {pageTitle}
                      </m.span>
                    </AnimatePresence>
                  </li>
                </ol>
              </nav>
              <Tooltip
                side="bottom"
                content={
                  <span className={styles.shortcut}>
                    {tPalette("trigger")}
                    <kbd>⌘K</kbd>
                  </span>
                }
              >
                <button
                  type="button"
                  className={styles.searchButton}
                  aria-label={tPalette("trigger")}
                  aria-keyshortcuts="Meta+K Control+K"
                  onClick={() => openPalette("trigger")}
                >
                  <Search className={styles.searchIcon} />
                  <span className={styles.searchLabel}>{tPalette("trigger")}</span>
                  <span className={styles.searchKbd} aria-hidden="true">
                    ⌘K
                  </span>
                </button>
              </Tooltip>
            </header>
            <div className={styles.content}>
              <Outlet />
            </div>
            <p className={styles.srOnly} role="status" aria-live="polite">
              {status}
            </p>
          </div>
          <Dialog.Root open={sheet} onOpenChange={setSheet}>
            <AnimatePresence>
              {sheet &&
                shell && (
                  <Dialog.Portal forceMount container={shell}>
                    <Dialog.Overlay asChild forceMount>
                      <m.div className={styles.scrim} style={{ opacity: scrimOpacity }} />
                    </Dialog.Overlay>
                    <Dialog.Content
                      asChild
                      forceMount
                      aria-describedby={undefined}
                      onCloseAutoFocus={(e) => {
                        e.preventDefault();
                        menuButtonRef.current?.focus({ preventScroll: true });
                      }}
                      onOpenAutoFocus={(e) => {
                        const current = sheetRef.current?.querySelector(
                          "[aria-current='page']",
                        );
                        if (current && !current.closest("[inert]")) {
                          e.preventDefault();
                          (current as HTMLElement).focus();
                        }
                      }}
                    >
                      <m.div
                        ref={sheetRef}
                        className={`${styles.sheet} fs-rail-tokens`}
                        style={{ x: sheetX }}
                        initial={{ x: "-100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "-100%" }}
                        transition={reduce ? INSTANT : T.spring.smooth}
                        drag={!prefersReduced && "x"}
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={{ left: 0.9, right: 0.04 }}
                        dragMomentum={false}
                        onDragStart={() => {
                          dragging.current = true;
                          sheetRef.current?.setAttribute("data-dragging", "");
                        }}
                        onDragEnd={(_e, info) => {
                          sheetRef.current?.removeAttribute("data-dragging");
                          window.setTimeout(() => {
                            dragging.current = false;
                          }, 0);
                          if (info.offset.x < -72 || info.velocity.x < -480)
                            setSheet(false);
                        }}
                      >
                        <Dialog.Title className={styles.srOnly}>
                          Navigation
                        </Dialog.Title>
                        <div className={styles.sheetHead}>
                          <Brand collapsed={false} reduce={reduce} />
                          <Dialog.Close asChild>
                            <button
                              type="button"
                              className={styles.iconButton}
                              aria-label="Close navigation"
                            >
                              <X size={18} strokeWidth={1.75} aria-hidden="true" />
                            </button>
                          </Dialog.Close>
                        </div>
                        <Nav
                          variant="sheet"
                          baseId={uid}
                          collapsed={false}
                          active={active}
                          open={open}
                          reduce={reduce}
                          onSelect={(id) => select(id, true)}
                          onGroup={(id) => toggleGroup(id, true)}
                        />
                        <Profile collapsed={false} reduce={reduce} />
                      </m.div>
                    </Dialog.Content>
                  </Dialog.Portal>
                )}
            </AnimatePresence>
          </Dialog.Root>
          <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
        </section>
      </TooltipPrimitive.Provider>
    </LayoutGroup>
  );
}

export default SidebarRail;
