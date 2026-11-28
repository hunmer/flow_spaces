"use client";

/**
 * Electron 无边框窗口的 macOS 风格标题栏（红绿灯 + 拖拽区）。
 *
 * - 仅在 Electron 桌面壳（window.electronAPI.windowControls 存在）时渲染。
 * - 拖拽移动窗口：整条标题栏 `.electron-titlebar-drag`（CSS app-region，
 *   Electron 原生支持双击标题栏切换最大化）；红绿灯区域 no-drag 保证可点击。
 * - 窗口控制走 IPC（preload 注入的 windowControls），最大化状态由主进程推送同步。
 * - 挂载时给 <body> 加 padding-top，把原有高度链（h-[var(--app-content-height)]）
 *   的可视区下移 38px，不遮挡页面自身头部。
 */
import { useEffect, useState } from "react";
import "@/styles/electron-titlebar.css";

type ElectronWindowControls = {
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizeChange: (callback: (maximized: boolean) => void) => () => void;
  setIcon?: (buffer: ArrayBuffer) => void;
};

const TITLEBAR_HEIGHT = 38;

/** macOS 红绿灯（品牌装饰色，非主题 token）。悬停整组时显现内部符号。 */
function TrafficLights({
  onMinimize,
  onToggleMaximize,
  onClose,
  maximized,
  lightsOnRight,
}: {
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
  maximized: boolean;
  /** Windows 模式：靠右显示，顺序镜像为 最小化/最大化/关闭（关闭最右） */
  lightsOnRight?: boolean;
}) {
  const dot = (color: string, symbol: string, onClick: () => void, label: string) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      className="grid size-3 cursor-pointer place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
      style={{ backgroundColor: color }}
    >
      <span className="pointer-events-none text-[9px] leading-none font-bold text-black/60 opacity-0 transition-opacity group-hover/titlebar:opacity-100">
        {symbol}
      </span>
    </button>
  );
  const dots = [
    dot("#ff5f57", "\u00d7", onClose, "关闭窗口"),
    dot("#febc2e", "\u2212", onMinimize, "最小化"),
    dot("#28c840", maximized ? "\u2219\u2219" : "\u2b1a", onToggleMaximize, "最大化 / 还原"),
  ];
  return (
    <div className="electron-titlebar-no-drag flex items-center gap-2">
      {lightsOnRight ? [dots[1], dots[2], dots[0]] : dots}
    </div>
  );
}

export function ElectronTitlebar() {
  const [controls, setControls] = useState<ElectronWindowControls | null>(null);
  const [maximized, setMaximized] = useState(false);
  // Windows 习惯红绿灯靠右；macOS/Linux 保持左侧
  const [lightsOnRight, setLightsOnRight] = useState(false);
  // 页面（如 mini-app 预览）通过 electron-titlebar:meta 事件替换标题栏图标与名称
  const [meta, setMeta] = useState<{ title?: string; icon?: string; avatarUrl?: string } | null>(null);

  useEffect(() => {
    const onMeta = (event: Event) => {
      setMeta((event as CustomEvent<{ title?: string; icon?: string; avatarUrl?: string } | null>).detail ?? null);
    };
    window.addEventListener("electron-titlebar:meta", onMeta as EventListener);
    return () => window.removeEventListener("electron-titlebar:meta", onMeta as EventListener);
  }, []);

  const setIcon = controls?.setIcon;
  // meta.avatarUrl 存在时同步窗口本体图标（任务栏/Alt-Tab），经 IPC 传字节到主进程
  useEffect(() => {
    if (!meta?.avatarUrl || !setIcon) return;
    let cancelled = false;
    fetch(meta.avatarUrl)
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .then((buffer) => {
        if (!cancelled && buffer) setIcon(buffer);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [meta?.avatarUrl, setIcon]);

  useEffect(() => {
    const api = (window as typeof window & {
      electronAPI?: {
        platform?: string;
        windowControls?: ElectronWindowControls;
      };
    }).electronAPI;
    const c = api?.windowControls ?? null;
    setControls(c);
    setLightsOnRight(api?.platform === "win32");
    if (!c) return;
    // 声明标题栏占用高度：body padding-top 与 #root 高度链（app-root.css calc）
    // 同时消费该变量，页面可视区精确缩短 38px，底部内容不再被裁剪
    document.documentElement.style.setProperty(
      "--electron-titlebar-height",
      `${TITLEBAR_HEIGHT}px`,
    );
    c.isMaximized().then(setMaximized).catch(() => {});
    const off = c.onMaximizeChange(setMaximized);
    return () => {
      off();
      document.documentElement.style.removeProperty("--electron-titlebar-height");
    };
  }, []);

  if (!controls) return null;

  const lights = (
    <div className="group/titlebar">
      <TrafficLights
        onMinimize={controls.minimize}
        onToggleMaximize={controls.toggleMaximize}
        onClose={controls.close}
        maximized={maximized}
        lightsOnRight={lightsOnRight}
      />
    </div>
  );
  const title = (
    <span className="flex select-none items-center gap-1.5 text-caption-1-semibold text-text-tertiary">
      {meta?.avatarUrl ? (
        <img
          src={meta.avatarUrl}
          alt=""
          className="size-4 rounded-sm object-cover"
          draggable={false}
        />
      ) : meta?.icon ? (
        <span className="text-xs leading-none" aria-hidden>
          {meta.icon}
        </span>
      ) : null}
      {meta?.title ?? "Flow Spaces"}
    </span>
  );

  return (
    <header
      className="electron-titlebar-drag fixed inset-x-0 top-0 z-[9999] flex h-[38px] items-center gap-3 border-b border-separator-border bg-background-primary-default ps-4 pe-4"
    >
      {lightsOnRight ? (
        <>
          {title}
          <div className="ms-auto">{lights}</div>
        </>
      ) : (
        <>
          {lights}
          {title}
        </>
      )}
    </header>
  );
}
